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
import { CodecValidationError } from "@shared/util-data";
import { coercePrimitive, createLogger } from "@shared/util-fp";
import { Schema, SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { absurd, pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import {
    Filter as MongoFilter,
    MongoClient,
    ObjectId,
    SortDirection
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
        const key = schemaInfoToString(info);
        const collection = db.collection<DocumentData>(key);
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
        const sort = orderBy
            ? {
                  [`data.${orderBy.fieldPath}`]: orderBy.direction,
              }
            : defaultSort;
        if (!Object.keys(sort).includes("_id")) {
            sort._id = orderBy?.direction ?? defaultDirection;
        }
        return sort;
    };

    const findByQuery = (
        query: Query
    ): TE.TaskEither<QueryError, EntryList> => {
        const { info, limit, cursor, where, orderBy } = query;
        const key = schemaInfoToString(info);
        const coll = db.collection<DocumentData>(key);
        const dir = orderBy?.direction ?? defaultDirection;
        const op = dir === "desc" ? "$lt" : "$gt";
        return pipe(
            TE.Do,
            TE.bind("sort", () => TE.right(calculateSort(orderBy))),
            TE.bind("cursorObj", ({ sort }) =>
                cursor
                    ? pipe(
                          decodeCursor(cursor),
                          E.chain((cursorObj) => {
                              if (cursorObj.dir !== dir) {
                                  return E.left(
                                      CodecValidationError.fromMessage(
                                          "Cursor direction does not match orderBy direction"
                                      )
                                  );
                              }
                              if (
                                  cursorObj.custom &&
                                  !sort[`data.${cursorObj.custom.fieldPath}`]
                              ) {
                                  return E.left(
                                      CodecValidationError.fromMessage(
                                          "Cursor field can't be different from order by field."
                                      )
                                  );
                              }
                              return E.right(cursorObj);
                          }),
                          TE.fromEither
                      )
                    : TE.right(undefined)
            ),
            //! TODO: this is suspectible to injection attacks
            //! we need to add sanitization for all inputs
            TE.bindW("records", ({ cursorObj, sort }) => {
                return wrapDbOperation(async () => {
                    const and = [];
                    if (where) {
                        and.push({
                            $and: convertFilters(where),
                        });
                    }
                    if (cursorObj) {
                        const or = [];
                        if (cursorObj.custom) {
                            const { fieldPath, value } = cursorObj.custom;
                            const primitiveValue = coercePrimitive(value);
                            const fixedPath = fieldPath === "_id" ? "_id" : `data.${fieldPath}`;
                            or.push({
                                [fixedPath]: {
                                    [op]: primitiveValue,
                                },
                            });
                            or.push({
                                [fixedPath]: {
                                    $eq: primitiveValue,
                                },
                                _id: {
                                    [op]: new ObjectId(cursorObj._id),
                                },
                            });
                        } else {
                            or.push({
                                _id: {
                                    [op]: new ObjectId(cursorObj._id),
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
                const entries = records.map((record) => ({
                    _id: record._id.toString(),
                    id: record.id,
                    record: record.data,
                }));
                const result: EntryList = {
                    info,
                    entries,
                };
                const lastEntry = entries[entries.length - 1];
                if (lastEntry) {
                    const nextCursor: Cursor = {
                        _id: lastEntry._id,
                        dir: dir,
                    };
                    // TODO: 👇 this won't work with nested fields (eg: field1.field2)
                    if (orderBy?.fieldPath && orderBy?.fieldPath !== "_id") {
                        nextCursor.custom = {
                            fieldPath: orderBy?.fieldPath,
                            value: String(lastEntry.record[orderBy.fieldPath]),
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
