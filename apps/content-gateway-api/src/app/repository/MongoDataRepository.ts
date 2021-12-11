import {
    DatabaseError,
    DataRepository,
    DataStorageError,
    Entry,
    EntryList,
    Filter,
    ListPayload,
    MissingSchemaError,
    OrderBy,
    Query,
    SchemaRepository,
    SinglePayload,
} from "@domain/feature-gateway";
import { coercePrimitive, createLogger } from "@shared/util-fp";
import { Schema, SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { absurd, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Filter as MongoFilter, MongoClient, ObjectId } from "mongodb";
import { Data, wrapDbOperation, wrapDbOperationWithParams } from ".";

export const createMongoDataRepository = ({
    dbName,
    mongoClient,
    schemaRepository,
}: {
    dbName: string;
    mongoClient: MongoClient;
    schemaRepository: SchemaRepository;
}): DataRepository => {
    const db = mongoClient.db(dbName);
    const logger = createLogger("MongoDataRepository");

    const upsertData = (
        data: SinglePayload
    ): TE.TaskEither<DatabaseError, void> => {
        const { info, record } = data;
        const key = schemaInfoToString(info);
        const collection = db.collection<Data>(key);
        const id = record.id as string;
        return pipe(
            wrapDbOperation(() =>
                collection.updateOne(
                    { id },
                    {
                        $set: {
                            data: record,
                            updatedAt: new Date(),
                        },
                        $setOnInsert: {
                            id: id,
                            createdAt: new Date(),
                        },
                    },
                    {
                        upsert: true,
                    }
                )
            )(),
            TE.map(() => {
                return undefined;
            })
        );
    };

    const validateRecords =
        (records: Record<string, unknown>[]) => (schema: Schema) => {
            return TE.fromEither(
                pipe(
                    records.map((record) => {
                        return schema.validate(record);
                    }),
                    E.sequenceArray
                )
            );
        };

    const store = (
        payload: SinglePayload
    ): TE.TaskEither<DataStorageError, void> => {
        const { info, record } = payload;
        return pipe(
            schemaRepository.find(info),
            TE.fromTaskOption(() => new MissingSchemaError(info)),
            TE.chainW(validateRecords([record])),
            TE.chainW(() => upsertData(payload)),
            TE.map(() => undefined)
        );
    };

    const storeBulk = (
        listPayload: ListPayload
    ): TE.TaskEither<DataStorageError, void> => {
        const { info, records } = listPayload;
        if (records.length === 0) {
            return TE.right(undefined);
        }
        const key = schemaInfoToString(info);
        const collection = db.collection<Data>(key);
        return pipe(
            schemaRepository.find(info),
            TE.fromTaskOption(() => new MissingSchemaError(info)),
            TE.chainW(validateRecords(records)),
            TE.map((recordList) => {
                return recordList.map((record) => {
                    const id = record.id as string;
                    return {
                        updateOne: {
                            filter: { id },
                            update: {
                                $set: {
                                    data: record,
                                    updatedAt: new Date(),
                                },
                                $setOnInsert: {
                                    id: id,
                                    createdAt: new Date(),
                                },
                            },
                            upsert: true,
                        },
                    };
                });
            }),
            TE.chainW(
                wrapDbOperationWithParams((updates) => {
                    return collection.bulkWrite(updates);
                })
            ),
            TE.map((result) => {
                logger.info("Bulk upsert results:", {
                    insertedCount: result.insertedCount,
                    matchedCount: result.matchedCount,
                    modifiedCount: result.modifiedCount,
                    upsertedCount: result.upsertedCount,
                    ok: result.ok,
                    hasWriteErrors: result.hasWriteErrors(),
                    writeErrorCount: result.getWriteErrorCount(),
                });
                return undefined;
            })
        );
    };

    const findById = (info: SchemaInfo, id: string): TO.TaskOption<Entry> => {
        const key = schemaInfoToString(info);
        const collection = db.collection<Data>(key);
        return pipe(
            TO.tryCatch(() =>
                collection.findOne({
                    id,
                })
            ),
            TO.chain((data) => {
                if (!data) {
                    return TO.none;
                } else {
                    return TO.of({
                        _id: data._id.toString(),
                        id: data.id,
                        record: data.data,
                    });
                }
            })
        );
    };

    const convertFilters = (where: Filter[]): MongoFilter<Data> => {
        const result = {} as MongoFilter<Data>;
        for (const filter of where) {
            const path = `data.${filter.fieldPath}`;
            switch (filter.type) {
                case "equals":
                    result[path] = {
                        $eq: filter.value,
                    };
                    break;
                case "not":
                    result[path] = {
                        $ne: filter.value,
                    };
                    break;
                case "contains":
                    result[path] = {
                        $regex: filter.value,
                    };
                    break;
                case "starts_with":
                    result[path] = {
                        $regex: new RegExp(`^${filter.value}.*`),
                    };
                    break;
                case "ends_with":
                    result[path] = {
                        $regex: new RegExp(`${filter.value}$`),
                    };
                    break;
                case "lt":
                    result[path] = {
                        $lt: filter.value,
                    };
                    break;
                case "gt":
                    result[path] = {
                        $gt: filter.value,
                    };
                    break;
                case "lte":
                    result[path] = {
                        $lte: filter.value,
                    };
                    break;
                case "gte":
                    result[path] = {
                        $gte: filter.value,
                    };
                    break;
                default:
                    absurd(filter.type);
            }
        }
        return result;
    };

    const findByQuery = (
        query: Query
    ): TE.TaskEither<DatabaseError, EntryList> => {
        const { info, limit, cursor, where } = query;
        return pipe(
            wrapDbOperation(async () => {
                const key = schemaInfoToString(info);
                const coll = db.collection<Data>(key);
                const orderBy: OrderBy = query.orderBy
                    ? {
                          fieldPath: `data.${query.orderBy.fieldPath}`,
                          direction: query.orderBy.direction,
                      }
                    : {
                          fieldPath: "_id",
                          direction: "asc",
                      };
                const sort = {
                    [orderBy.fieldPath]: orderBy.direction,
                };
                const conds = [];
                if (where) {
                    conds.push(convertFilters(where));
                }
                if (cursor) {
                    const gt =
                        orderBy.fieldPath === "_id"
                            ? new ObjectId(cursor)
                            : // * this is not nice, but what the hell
                              coercePrimitive(cursor);
                    conds.push({
                        $or: [
                            {
                                [orderBy.fieldPath]: {
                                    $gt: gt,
                                },
                            },
                        ],
                    });
                }
                const filter = conds.length > 0 ? { $and: conds } : {};
                return coll.find(filter).sort(sort).limit(limit).toArray();
            })(),
            TE.map((records) => {
                const entries = records.map((record) => ({
                    _id: record._id.toString(),
                    id: record.id,
                    record: record.data,
                }));
                return {
                    info,
                    entries,
                };
            })
        );
    };

    return {
        store,
        storeBulk,
        findById,
        findByQuery,
    };
};
