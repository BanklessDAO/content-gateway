import { Prisma, PrismaClient } from "@cga/prisma";
import {
    BulkData,
    Data,
    DatabaseStorageError,
    DataStorage,
    DataValidationError,
    Filters,
    MissingSchemaError,
    SchemaFilter,
    SchemaStorage,
    StorageError,
    StoredBulkData,
    StoredData
} from "@domain/feature-gateway";
import { OperatorType } from "@shared/util-loaders";
import { Schema, ValidationError } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Logger } from "tslog";

const operatorLookup = {
    [OperatorType.EQUALS]: "equals",
    [OperatorType.CONTAINS]: "string_contains",
    [OperatorType.GREATER_THAN_OR_EQUAL]: "gte",
    [OperatorType.LESS_THAN_OR_EQUAL]: "lte",
} as const;

type PrismaErrors =
    | Prisma.PrismaClientKnownRequestError
    | Prisma.PrismaClientUnknownRequestError
    | Prisma.PrismaClientValidationError;

export const createPrismaDataStorage = (
    prisma: PrismaClient,
    schemaStorage: SchemaStorage
): DataStorage => {
    const logger = new Logger({ name: "PrismaDataStorage" });

    const wrapPrismaOperation = <T>(op: () => Promise<T>) => {
        return TE.tryCatch(
            async () => {
                return op();
            },
            (e: PrismaErrors) => {
                return new DatabaseStorageError(e);
            }
        );
    };

    const upsertData = (data: Data) => {
        const { info, record } = data;
        const toSave = {
            upstreamId: record.id as string,
            data: record as Prisma.JsonObject,
            ...info,
        };
        return prisma.data.upsert({
            where: {
                namespace_name_version_upstreamId: {
                    ...info,
                    upstreamId: record.id as string,
                },
            },
            create: toSave,
            update: toSave,
        });
    };

    const validateRecords = (
        schema: Schema,
        records: Record<string, unknown>[]
    ) => {
        return pipe(
            records.map((record) => {
                return schema.validate(record);
            }),
            E.sequenceArray,
            E.mapLeft((e: ValidationError[]) => {
                return new DataValidationError(e);
            }),
            TE.fromEither
        );
    };

    return {
        store: (payload: Data): TE.TaskEither<StorageError, StoredData> => {
            const { info, record } = payload;
            return pipe(
                schemaStorage.find(info),
                TE.fromTaskOption(
                    () => new MissingSchemaError(info) as StorageError
                ),
                TE.chainW((schema) => {
                    return pipe(
                        TE.fromEither(schema.validate(record)),
                        TE.mapLeft((e: ValidationError[]) => {
                            return new DataValidationError(e);
                        })
                    );
                }),
                TE.chain(() => {
                    return wrapPrismaOperation(() => upsertData(payload));
                }),
                TE.map((data) => ({
                    ...payload,
                    id: data.id,
                }))
            );
        },
        storeBulk: (
            bulkData: BulkData
        ): TE.TaskEither<StorageError, StoredBulkData> => {
            const { info, records } = bulkData;
            return pipe(
                schemaStorage.find(info),
                TE.fromTaskOption(() => new Error("Schema not found")),
                TE.chainW((schema) => {
                    return validateRecords(schema, records);
                }),
                TE.chain((records) => {
                    return wrapPrismaOperation(() => {
                        return prisma.$transaction(
                            records.map((record) =>
                                upsertData({ info, record })
                            )
                        );
                    });
                }),
                TE.map((data) => {
                    return {
                        info: info,
                        entries: data.map((d) => ({
                            id: d.id,
                            record: d.data as Record<string, unknown>,
                        })),
                    };
                })
            );
        },
        findBySchema: (filter: SchemaFilter): T.Task<Array<StoredData>> => {
            let params;
            const { cursor, limit, info } = filter;
            if (cursor) {
                params = {
                    skip: 1, // this is because we skip the cursor
                    take: limit,
                    where: {
                        ...info,
                    },
                    cursor: {
                        id: cursor,
                    },
                    orderBy: {
                        id: "asc",
                    },
                };
            } else {
                params = {
                    take: limit,
                    where: {
                        ...info,
                    },
                };
            }
            return pipe(
                () => prisma.data.findMany(params),
                T.map((data) =>
                    data.map((d) => ({
                        id: d.id,
                        info: filter.info,
                        record: d.data as Record<string, unknown>,
                    }))
                )
            );
        },
        findById: (id: bigint): TO.TaskOption<StoredData> =>
            pipe(
                TO.tryCatch(() =>
                    prisma.data.findUnique({
                        where: {
                            id: id,
                        },
                    })
                ),
                TO.chain((record) => {
                    if (!record) {
                        return TO.none;
                    } else {
                        return TO.of({
                            id: record.id,
                            info: {
                                namespace: record.namespace,
                                name: record.name,
                                version: record.version,
                            },
                            record: record.data as Record<string, unknown>,
                        });
                    }
                })
            ),
        findByFilters: (filters: Filters): T.Task<Array<StoredData>> => {
            let where = filters.operators.map((op) => {
                const operator = operatorLookup[op.type];
                return {
                    data: {
                        path: [op.field],
                        [operator]: op.value,
                    },
                };
            }) as unknown[];
            where = [
                ...where,
                {
                    namespace: filters.info.namespace,
                },
                {
                    name: filters.info.name,
                },
                {
                    version: filters.info.version,
                },
            ];
            let params;
            if (filters.cursor) {
                params = {
                    skip: 1, // this is because we skip the cursor
                    take: filters.limit,
                    where: {
                        AND: where,
                    },
                    cursor: {
                        id: filters.cursor,
                    },
                    orderBy: {
                        id: "asc",
                    },
                };
            } else {
                params = {
                    take: filters.limit,
                    where: {
                        AND: where,
                    },
                };
            }
            return pipe(
                () => prisma.data.findMany(params),
                T.map((items) => {
                    return items.map((item) => ({
                        id: item.id,
                        info: {
                            namespace: item.namespace,
                            name: item.name,
                            version: item.version,
                        },
                        record: item.data as Record<string, unknown>,
                    }));
                })
            );
        },
    };
};
