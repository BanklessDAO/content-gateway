import {
    Cursor,
    DatabaseError,
    DataRepository,
    DataStorageError,
    decodeCursor,
    encodeCursor,
    Entry,
    EntryList,
    Filter,
    ListPayload,
    MissingSchemaError,
    OrderBy,
    OrderDirection,
    Query,
    QueryError,
    SchemaRepository,
    SinglePayload
} from "@domain/feature-gateway";
import { CodecValidationError } from "@banklessdao/util-data";
import { coercePrimitive, createLogger } from "@banklessdao/util-misc";
import { Schema, SchemaInfo, schemaInfoToString } from "@banklessdao/util-schema";
import * as E from "fp-ts/Either";
import { absurd, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import {
    Filter as MongoFilter,
    MongoClient,
    ObjectId,
    SortDirection,
    WithId
} from "mongodb";
import { DocumentData, wrapDbOperation, wrapDbOperationWithParams } from ".";

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
        const collection = db.collection<DocumentData>(key);
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
        const collection = db.collection<DocumentData>(key);
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
        const coll = db.collection<DocumentData>(schemaInfoToString(info));
        return pipe(
            TO.tryCatch(() =>
                coll.findOne({
                    id,
                })
            ),
            TO.chain((data) => {
                if (!data) {
                    return TO.none;
                } else {
                    return TO.of({
                        id: data.id,
                        record: data.data,
                    });
                }
            })
        );
    };

    const convertFilters = (where: Filter[]): MongoFilter<DocumentData> => {
        const result = [] as MongoFilter<DocumentData>;
        for (const filter of where) {
            const path = `data.${filter.fieldPath}`;
            switch (filter.type) {
                case "equals":
                    result.push({
                        [path]: {
                            $eq: filter.value,
                        },
                    });
                    break;
                case "not":
                    result.push({
                        [path]: {
                            $ne: filter.value,
                        },
                    });
                    break;
                case "contains":
                    result.push({
                        [path]: {
                            $regex: filter.value,
                        },
                    });
                    break;
                case "starts_with":
                    result.push({
                        [path]: {
                            $regex: new RegExp(`^${filter.value}.*`),
                        },
                    });
                    break;
                case "ends_with":
                    result.push({
                        [path]: {
                            $regex: new RegExp(`${filter.value}$`),
                        },
                    });
                    break;
                case "lt":
                    result.push({
                        [path]: {
                            $lt: filter.value,
                        },
                    });
                    break;
                case "gt":
                    result.push({
                        [path]: {
                            $gt: filter.value,
                        },
                    });
                    break;
                case "lte":
                    result.push({
                        [path]: {
                            $lte: filter.value,
                        },
                    });
                    break;
                case "gte":
                    result.push({
                        [path]: {
                            $gte: filter.value,
                        },
                    });
                    break;
                default:
                    absurd(filter.type);
            }
        }
        return result;
    };

    const defaultDirection: OrderDirection = "asc";

    const defaultSort = {
        _id: defaultDirection,
    };

    const calculateSort = (
        orderBy?: OrderBy
    ): Record<string, SortDirection> => {
        const dir = orderBy?.direction ?? defaultDirection;
        const fixedPath = `data.${orderBy?.fieldPath}`;
        const sort = orderBy
            ? {
                  [fixedPath]: dir,
              }
            : defaultSort;
        sort._id = dir;
        return sort;
    };

    //! TODO: this is suspectible to injection attacks
    //! we need to add sanitization for all inputs
    const findByQuery = (
        query: Query
    ): TE.TaskEither<QueryError, EntryList> => {
        const { info, limit, where, orderBy } = query;
        const key = schemaInfoToString(info);
        const coll = db.collection<DocumentData>(key);
        const dir = orderBy?.direction ?? defaultDirection;
        const op = dir === "desc" ? "$lt" : "$gt";
        return pipe(
            TE.Do,
            TE.bind("sort", () => TE.right(calculateSort(orderBy))),
            TE.bind("cursor", ({ sort }) =>
                query.cursor
                    ? pipe(
                          decodeCursor(query.cursor),
                          E.chain((cursor) => {
                              if (cursor.dir !== dir) {
                                  return E.left(
                                      CodecValidationError.fromMessage(
                                          `Cursor direction ${cursor.dir} does not match orderBy direction ${dir}.`
                                      )
                                  );
                              }
                              if (
                                  cursor.custom &&
                                  !sort[cursor.custom.fieldPath]
                              ) {
                                  return E.left(
                                      CodecValidationError.fromMessage(
                                          "Cursor field can't be different from order by field."
                                      )
                                  );
                              }
                              return E.right(cursor);
                          }),
                          TE.fromEither
                      )
                    : TE.right(undefined)
            ),
            TE.bindW("records", ({ cursor, sort }) => {
                return wrapDbOperation(async () => {
                    const and = [];
                    if (where) {
                        const filters = convertFilters(where);
                        if (Object.keys(filters).length > 0) {
                            and.push({
                                $and: convertFilters(where),
                            });
                        }
                    }
                    if (cursor) {
                        const or = [];
                        if (cursor.custom) {
                            const { fieldPath, value } = cursor.custom;
                            const primitiveValue = coercePrimitive(value);
                            or.push({
                                [fieldPath]: {
                                    [op]: primitiveValue,
                                },
                            });
                            //* 👇 Tiebreaker
                            or.push({
                                [fieldPath]: {
                                    $eq: primitiveValue,
                                },
                                _id: {
                                    [op]: new ObjectId(cursor._id),
                                },
                            });
                        } else {
                            or.push({
                                _id: {
                                    [op]: new ObjectId(cursor._id),
                                },
                            });
                        }
                        and.push({
                            $or: or,
                        });
                    }
                    const filter = and.length > 0 ? { $and: and } : {};
                    return coll
                        .find(filter as MongoFilter<DocumentData>)
                        .sort(sort)
                        .limit(limit)
                        .toArray();
                })();
            }),
            TE.map(({ records }) => {
                let lastRecord: WithId<DocumentData> | undefined = undefined;
                const entries = records.map((record) => {
                    lastRecord = record;
                    return {
                        id: record.id,
                        record: record.data,
                    };
                });
                const result: EntryList = {
                    info,
                    entries,
                };
                if (
                    typeof lastRecord !== "undefined" &&
                    entries.length === limit
                ) {
                    const lr = lastRecord as WithId<DocumentData>;
                    const nextCursor: Cursor = {
                        _id: lr._id.toString(),
                        dir: dir,
                    };
                    // TODO: 👇 This won't work with nested fields (eg: a.b)
                    if (orderBy?.fieldPath && orderBy.fieldPath !== "_id") {
                        nextCursor.custom = {
                            fieldPath: `data.${orderBy.fieldPath}`,
                            value: String(lr.data[orderBy.fieldPath]),
                        };
                    }
                    result.nextPageToken = encodeCursor(nextCursor);
                }
                return result;
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
