import { Data, Prisma, PrismaClient } from "@cga/prisma";
import {
    DatabaseError,
    DataRepository,
    DataValidationError,
    EntryList,
    EntryWithInfo,
    ListPayload,
    MissingSchemaError,
    OperatorFilter,
    SchemaFilter,
    SchemaRepository,
    SinglePayload,
    StorageError,
} from "@domain/feature-gateway";
import { createLogger } from "@shared/util-fp";
import { OperatorType } from "@shared/util-loaders";
import { Schema, SchemaInfo, ValidationError } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";

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

type PrismaCursor = {
    id: bigint;
};

export const createPrismaDataRepository = (
    prisma: PrismaClient,
    schemaRepository: SchemaRepository
): DataRepository => {
    const logger = createLogger("PrismaDataRepository");
    const upsertData = (data: SinglePayload) => {
        const { info, record } = data;
        const toSave = {
            ...info,
            upstreamId: record.id as string,
            data: record as Prisma.JsonObject,
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
            })
        );
    };

    const prismaDataToEntries = (info: SchemaInfo) => {
        return TE.map((data: Data[]) => ({
            info: info,
            entries: data.map((d) => {
                return {
                    id: d.id,
                    record: d.data as Record<string, unknown>,
                };
            }),
        }));
    };

    return {
        store: (
            payload: SinglePayload
        ): TE.TaskEither<StorageError, EntryWithInfo> => {
            const { info, record } = payload;
            return pipe(
                schemaRepository.find(info),
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
                    return TE.tryCatch(
                        () => upsertData({ ...payload }),
                        (e: PrismaErrors) => new DatabaseError(e)
                    );
                }),
                TE.map((data) => ({
                    id: data.id,
                    info: info,
                    record: data.data as Record<string, unknown>,
                }))
            );
        },
        storeBulk: (
            listPayload: ListPayload
        ): TE.TaskEither<StorageError, EntryList> => {
            const { info, records } = listPayload;
            return pipe(
                schemaRepository.find(info),
                TE.fromTaskOption(
                    () => new MissingSchemaError(info) as StorageError
                ),
                TE.chainW((schema) => {
                    return TE.fromEither(validateRecords(schema, records));
                }),
                TE.map((data) => {
                    return data.map((record) => {
                        return {
                            info,
                            record,
                        };
                    });
                }),
                TE.chain((data) => {
                    return TE.tryCatch(
                        () =>
                            prisma.$transaction(
                                data.map((record) => upsertData(record))
                            ),
                        (e: PrismaErrors) => new DatabaseError(e)
                    );
                }),
                TE.map((items) => ({
                    info: info,
                    entries: items.map((item) => ({
                        id: item.id,
                        info: info,
                        record: item.data as Record<string, unknown>,
                    })),
                }))
            );
        },
        findById: (id: bigint): TO.TaskOption<EntryWithInfo> => {
            return pipe(
                TO.tryCatch(() =>
                    prisma.data.findUnique({
                        where: { id },
                    })
                ),
                TO.chain((data) => {
                    if (!data) {
                        return TO.none;
                    } else {
                        return TO.of({
                            id: data.id,
                            info: {
                                namespace: data.namespace,
                                name: data.name,
                                version: data.version,
                            },
                            record: data.data as Record<string, unknown>,
                        });
                    }
                })
            );
        },
        findBySchema: (
            filter: SchemaFilter
        ): TE.TaskEither<StorageError, EntryList> => {
            const { cursor, limit, info } = filter;
            let cursorToUse: PrismaCursor | undefined = undefined;
            let skip = 0;
            if (cursor) {
                skip = 1;
                cursorToUse = {
                    id: cursor,
                };
            }
            return pipe(
                TE.tryCatch(
                    () =>
                        prisma.data.findMany({
                            take: limit,
                            where: {
                                ...info,
                            },
                            orderBy: {
                                id: "asc",
                            },
                            skip: skip,
                            cursor: cursorToUse,
                        }),
                    (e: PrismaErrors) => new DatabaseError(e)
                ),
                prismaDataToEntries(info)
            );
        },
        findByFilters: (
            filters: OperatorFilter
        ): TE.TaskEither<StorageError, EntryList> => {
            const { cursor, limit, info, operators } = filters;
            const { namespace, name, version } = info;
            let where = operators.map((op) => {
                const operator = operatorLookup[op.type];
                return {
                    data: {
                        path: [op.field],
                        [operator]: op.value,
                    },
                };
            }) as unknown[];
            where = [...where, { namespace }, { name }, { version }];
            let cursorToUse: PrismaCursor | undefined = undefined;
            let skip: undefined | number = undefined;
            if (cursor) {
                skip = 1;
                cursorToUse = {
                    id: cursor,
                };
            }

            return pipe(
                TE.tryCatch(
                    () =>
                        prisma.data.findMany({
                            take: limit,
                            where: {
                                AND: where,
                            },
                            orderBy: {
                                id: "asc",
                            },
                            skip: skip,
                            cursor: cursorToUse,
                        }),
                    (e: PrismaErrors) => new DatabaseError(e)
                ),
                prismaDataToEntries(info)
            );
        },
    };
};
