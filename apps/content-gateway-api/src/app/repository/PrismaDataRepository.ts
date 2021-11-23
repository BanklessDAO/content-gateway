import { Data, Prisma, PrismaClient, PrismaPromise } from "@cga/prisma";
import {
    DatabaseError,
    DataRepository,
    DataStorageError,
    EntryList,
    EntryWithInfo,
    FilterType,
    ListPayload,
    MissingSchemaError,
    OrderDirection,
    Query,
    SchemaFilter,
    SchemaRepository,
    SinglePayload
} from "@domain/feature-gateway";
import { Schema, SchemaInfo } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { wrapPrismaOperation } from ".";

const filterLookup = {
    ...FilterType,
    contains: "string_contains",
    starts_with: "string_starts_with",
    ends_with: "string_ends_with",
} as const;

type PrismaCursor = {
    id: bigint;
};

export const createPrismaDataRepository = (
    prisma: PrismaClient,
    schemaRepository: SchemaRepository
): DataRepository => {
    const upsertData = (data: SinglePayload): PrismaPromise<Data> => {
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
        ): TE.TaskEither<DataStorageError, EntryWithInfo> => {
            const { info, record } = payload;
            return pipe(
                schemaRepository.find(info),
                TE.fromTaskOption(() => new MissingSchemaError(info)),
                TE.chainW(validateRecords([record])),
                TE.chainW(
                    wrapPrismaOperation(() => upsertData({ ...payload }))
                ),
                TE.map((data) => ({
                    id: data.id,
                    info: info,
                    record: data.data as Record<string, unknown>,
                }))
            );
        },
        storeBulk: (
            listPayload: ListPayload
        ): TE.TaskEither<DataStorageError, EntryList> => {
            const { info, records } = listPayload;
            return pipe(
                schemaRepository.find(info),
                TE.fromTaskOption(() => new MissingSchemaError(info)),
                TE.chainW(validateRecords(records)),
                TE.map((recordList) => {
                    return recordList.map((record) => {
                        return {
                            info,
                            record,
                        };
                    });
                }),
                TE.chainW(
                    wrapPrismaOperation((recordList) =>
                        prisma.$transaction(
                            recordList.map((record) => upsertData(record))
                        )
                    )
                ),
                TE.map((savedRecords) => ({
                    info: info,
                    entries: savedRecords.map((savedRecord) => ({
                        id: savedRecord.id,
                        info: info,
                        record: savedRecord.data as Record<string, unknown>,
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
        ): TE.TaskEither<DatabaseError, EntryList> => {
            const { limit, info } = filter;
            let cursor: PrismaCursor | undefined = undefined;
            let skip = 0;
            if (filter.cursor) {
                skip = 1;
                cursor = {
                    id: filter.cursor,
                };
            }
            return pipe(
                null,
                wrapPrismaOperation(() =>
                    prisma.data.findMany({
                        take: limit,
                        where: {
                            ...info,
                        },
                        orderBy: {
                            id: "asc",
                        },
                        skip: skip,
                        cursor: cursor,
                    })
                ),
                prismaDataToEntries(info)
            );
        },
        findByQuery: (
            query: Query
        ): TE.TaskEither<DatabaseError, EntryList> => {
            const { limit, info, where: filters } = query;
            const { namespace, name, version } = info;

            // * Here you can pass the wrong parameters (for example a string for greater than or equal).
            // * 👇 We can add schema checking later. The GraphQL layer will check it for now .
            let where: Record<string, unknown>[] = (filters ?? []).map((op) => {
                const filter = filterLookup[op.type];
                return {
                    data: {
                        path: op.fieldPath,
                        [filter]: op.value,
                    },
                };
            });
            const orderBy: Record<string, OrderDirection> = {
                id: "asc",
            };
            where = [...where, { namespace }, { name }, { version }];
            let cursor: PrismaCursor | undefined = undefined;
            let skip: undefined | number = undefined;
            if (query.cursor) {
                skip = 1;
                cursor = {
                    id: query.cursor,
                };
            }
            return pipe(
                null,
                wrapPrismaOperation(() =>
                    prisma.data.findMany({
                        take: limit,
                        where: {
                            AND: where,
                        },
                        orderBy: orderBy,
                        skip: skip,
                        cursor: cursor,
                    })
                ),
                prismaDataToEntries(info)
            );
        },
    };
};
