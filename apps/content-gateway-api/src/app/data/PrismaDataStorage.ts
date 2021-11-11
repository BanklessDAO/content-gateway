import { Prisma, PrismaClient } from "@cga/prisma";
import {
    Data,
    DataStorage,
    Filters,
    SchemaFilter,
    SchemaStorage,
} from "@domain/feature-gateway";
import { OperatorType } from "@shared/util-loaders";
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

export const createPrismaDataStorage = (
    prisma: PrismaClient,
    schemaStorage: SchemaStorage
): DataStorage => {
    const logger = new Logger({ name: "PrismaDataStorage" });
    return {
        store: (payload: Data): TE.TaskEither<Error, Data> => {
            return pipe(
                schemaStorage.find(payload.info),
                TE.fromTaskOption(() => new Error("Schema not found")),
                TE.chainW((schema) => {
                    return TE.fromEither(schema.validate(payload.data));
                }),
                TE.chain((record) => {
                    return TE.tryCatch(
                        async () =>
                            prisma.data.create({
                                data: {
                                    upstreamId: record.id as string,
                                    data: record as Prisma.JsonObject,
                                    ...payload.info,
                                },
                            }),
                        (e: Error) => {
                            const msg = `Failed to store data: ${e.message}`;
                            logger.warn(msg);
                            return new Error(msg);
                        }
                    );
                }),
                TE.map((data) => ({
                    ...payload,
                    id: data.id,
                }))
            );
        },
        findBySchema: (filter: SchemaFilter): T.Task<Array<Data>> => {
            let params;
            if (filter.cursor) {
                params = {
                    skip: 1, // this is because we skip the cursor
                    take: filter.limit,
                    where: {
                        ...filter.info,
                    },
                    cursor: {
                        id: filter.cursor,
                    },
                    orderBy: {
                        id: "asc",
                    },
                };
            } else {
                params = {
                    take: filter.limit,
                    where: {
                        ...filter.info,
                    },
                };
            }
            return pipe(
                () => prisma.data.findMany(params),
                T.map((data) =>
                    data.map((d) => ({
                        id: d.id,
                        info: filter.info,
                        data: d.data as Record<string, unknown>,
                    }))
                )
            );
        },
        findById: (id: bigint): TO.TaskOption<Data> =>
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
                            data: record.data as Record<string, unknown>,
                        });
                    }
                })
            ),
        findByFilters: (filters: Filters): T.Task<Array<Data>> => {
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
                        data: item.data as Record<string, unknown>,
                    }));
                })
            );
        },
    };
};
