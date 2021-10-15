import { Data, DataStorage } from "@domain/feature-gateway";
import { Prisma, PrismaClient } from "@prisma/client";
import { SchemaInfo } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";

export const createPrismaDataStorage = (): DataStorage => {
    const prisma = new PrismaClient();
    return {
        store: (payload: Data): TE.TaskEither<Error, string> => {
            const { namespace, name, version } = payload.info;
            return pipe(
                TE.tryCatch(
                    () => {
                        return prisma.data.create({
                            data: {
                                id: payload.data.id as string,
                                schemaNamespace: namespace,
                                schemaName: name,
                                schemaVersion: version,
                                createdAt: new Date(),
                                updatedAt: new Date(),
                                data: payload.data as Prisma.JsonObject,
                            },
                        });
                    },
                    (e: Error) => e
                ),
                TE.map((data) => data.id)
            );
        },
        findBySchema: (key: SchemaInfo): TE.TaskEither<Error, Array<Data>> => {
            return pipe(
                TE.tryCatch(
                    () => {
                        return prisma.data.findMany({
                            where: {
                                schemaNamespace: key.namespace,
                                schemaName: key.name,
                                schemaVersion: key.version,
                            },
                        });
                    },
                    (e: Error) => e
                ),
                TE.map((data) =>
                    // TODO: this can be more expressive
                    data.map((d) => ({
                        info: key,
                        data: d.data as Record<string, unknown>,
                    }))
                )
            );
        },
        findById: <T>(id: string): TO.TaskOption<T> => {
            prisma.data.findOne({
                where: {
                }
            });
            return TO.none;
        },
    };
};
