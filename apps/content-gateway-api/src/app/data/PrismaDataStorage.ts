// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { Prisma, PrismaClient } from "@cga/prisma";
import { Data, DataStorage, SchemaStorage } from "@domain/feature-gateway";
import { SchemaInfo } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Logger } from "tslog";

export const createPrismaDataStorage = (
    prisma: PrismaClient,
    schemaStorage: SchemaStorage
): DataStorage => {
    const logger = new Logger({ name: "PrismaDataStorage" });
    return {
        store: (payload: Data): TE.TaskEither<Error, string> =>
            pipe(
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
                                    id: record.id as string,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
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
                TE.map((data) => data.id)
            ),
        findBySchema: (info: SchemaInfo): TO.TaskOption<Array<Data>> => {
            return pipe(
                TO.tryCatch(() => {
                    return prisma.data.findMany({
                        where: {
                            ...info,
                        },
                    });
                }),
                TO.map((data) =>
                    data.map((d) => ({
                        info: info,
                        data: d.data as Record<string, unknown>,
                    }))
                )
            );
        },
        findById: (id: string): TO.TaskOption<Data> => 
            pipe(
                TO.tryCatch(() =>
                    prisma.data.findUnique({
                        where: {
                            // TODO: ❗ change this because id might not be globally unique!
                            id: id,
                        },
                    })
                ),
                TO.chain((record) => {
                    if (!record) {
                        return TO.none;
                    } else {
                        return TO.of({
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
        filterByFieldValue: (field: string, value: any): TO.TaskOption<Array<Data>> => {
            return pipe(
                TO.tryCatch(() => {
                    return prisma.data.findMany({
                        where: {
                            data: {
                                path: [field],
                                equals: value,
                            }
                        },
                    });
                }),
                TO.map((items) => {
                    return items.map((i) => ({
                        info: {
                            namespace: i.namespace,
                            name: i.name,
                            version: i.version,
                        },
                        data: i.data as Record<string, unknown>,
                    }))
                })
            )
        },
        filterByFieldContainingValue: (field: string, value: any): TO.TaskOption<Array<Data>> => {
            return pipe(
                TO.tryCatch(() => {
                    return prisma.data.findMany({
                        where: {
                            data: {
                                path: [field],
                                string_contains: value,
                            }
                        },
                    });
                }),
                TO.map((items) => {
                    return items.map((i) => ({
                        info: {
                            namespace: i.namespace,
                            name: i.name,
                            version: i.version,
                        },
                        data: i.data as Record<string, unknown>,
                    }))
                })
            )
        },
        filterByFieldComparedToValue: (field: string, value: number, comparison: string): TO.TaskOption<Array<Data>> => {
            return pipe(
                TO.tryCatch(() => {
                    // TODO: Obviously need to add a proper mapper for these comparison codes
                    // TODO: Obviously the operands need to be checked for conformance to comparable interface
                    let operation;
                    switch (comparison) {
                        case 'lessThan':
                            operation = {
                                path: [field],
                                lte: value,
                            };
                        case 'greaterThan':
                            operation = {
                                path: [field],
                                gte: value,
                            };
                        default:
                            operation = {
                                path: [field],
                                gte: value,
                            };
                    }

                    return prisma.data.findMany({
                        where: {
                            data: operation
                        },
                    });
                }),
                TO.map((items) => {
                    return items.map((i) => ({
                        info: {
                            namespace: i.namespace,
                            name: i.name,
                            version: i.version,
                        },
                        data: i.data as Record<string, unknown>,
                    }))
                })
            )
        },
    };
};
