import { Data, DataStorage } from "@domain/feature-gateway";
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { Prisma, PrismaClient } from "@cga/prisma";
import { Schema, SchemaInfo } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Errors } from "io-ts";

export const createPrismaDataStorage = (
    createSchema: (
        info: SchemaInfo,
        schema: Record<string, unknown>
    ) => E.Either<Errors, Schema>,
    prisma: PrismaClient
): DataStorage => {
    const findSchema = (info: SchemaInfo) =>
        pipe(
            TE.tryCatch(
                () =>
                    prisma.schema.findUnique({
                        where: { namespace_name_version: info },
                    }),
                (e) => new Error(`Failed to find schema: ${e}`)
            ),
            TE.chainW((schemaEntity) =>
                TE.fromEither(
                    createSchema(
                        info,
                        schemaEntity.schemaObject as Record<string, unknown>
                    )
                )
            )
        );

    return {
        store: (payload: Data): TE.TaskEither<Error, string> =>
            pipe(
                findSchema(payload.info),
                TE.chainW((schema) => {
                    return TE.fromEither(schema.validate(payload.data));
                }),
                TE.chain((record) => {
                    return TE.tryCatch(
                        () =>
                            prisma.data.create({
                                data: {
                                    id: record.id as string,
                                    createdAt: new Date(),
                                    updatedAt: new Date(),
                                    data: record as Prisma.JsonObject,
                                    ...payload.info,
                                },
                            }),
                        (e: Error) =>
                            new Error(`Failed to store data: ${e.message}`)
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
    };
};
