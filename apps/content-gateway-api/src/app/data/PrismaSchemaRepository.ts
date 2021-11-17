// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient, Schema as PrismaSchema } from "@cga/prisma";
import {
    RegisteredSchemaIncompatibleError,
    SchemaCreationFailedError,
    SchemaCursorUpdateFailedError,
    SchemaRepository
} from "@domain/feature-gateway";
import {
    createSchemaFromObject,
    Schema,
    SchemaInfo
} from "@shared/util-schema";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Errors } from "io-ts";

export const createPrismaSchemaRepository = (
    prisma: PrismaClient
): SchemaRepository => {
    const findSchema = (info: SchemaInfo) => {
        return pipe(
            TO.tryCatch(() => {
                return prisma.schema.findUnique({
                    where: { namespace_name_version: info },
                });
            }),
            TO.chain((entity) => TO.fromNullable(entity)),
            TO.chain((schemaEntity) => {
                return TO.fromEither(
                    createSchemaFromObject({
                        info: info,
                        jsonSchema: schemaEntity.jsonSchema as Record<
                            string,
                            unknown
                        >,
                    })
                );
            })
        );
    };

    const upsertSchema = (schema: Schema) =>
        TE.tryCatch(
            () => {
                const data = {
                    ...schema.info,
                    jsonSchema: schema.jsonSchema,
                };
                return prisma.schema.upsert({
                    where: {
                        namespace_name_version: schema.info,
                    },
                    create: data,
                    update: data,
                });
            },
            (e: Error) => SchemaCreationFailedError.create(e.message)
        );

    const prismaSchemaToSchema: (
        schema: PrismaSchema
    ) => E.Either<Errors, Schema> = (schema) =>
        createSchemaFromObject({
            info: {
                namespace: schema.namespace,
                name: schema.name,
                version: schema.version,
            },
            jsonSchema: schema.jsonSchema as Record<string, unknown>,
        });

    return {
        register: (schema: Schema) => {
            return pipe(
                TE.tryCatch(
                    async () => {
                        const o = await findSchema(schema.info)();
                        return Promise.resolve(O.getOrElse(() => schema)(o));
                    },
                    (err: Error) =>
                        SchemaCreationFailedError.create(err.message)
                ),
                TE.chain((oldSchema) => {
                    if (schema.isBackwardCompatibleWith(oldSchema)) {
                        return upsertSchema(schema);
                    } else {
                        return TE.left(
                            RegisteredSchemaIncompatibleError.create(
                                schema.info
                            )
                        );
                    }
                }),
                TE.map(() => undefined)
            );
        },
        find: findSchema,
        findAll: () => {
            return pipe(
                TO.tryCatch(async () => {
                    return prisma.schema.findMany();
                }),
                TO.chain((entities) => {
                    return TO.some(
                        pipe(
                            entities.map(prismaSchemaToSchema),
                            A.filter(E.isRight),
                            A.map((item) => item.right)
                        )
                    );
                })
            );
        },
        updateCursor: (info: SchemaInfo, cursor: number) => {
            return pipe(
                TE.tryCatch(
                    async () => {
                        prisma.schema.update({
                            where: {
                                namespace_name_version: info,
                            },
                            data: cursor,
                        });
                    },
                    (err: Error) =>
                        SchemaCursorUpdateFailedError.create(err.message)
                )
            );
        },
    };
};
