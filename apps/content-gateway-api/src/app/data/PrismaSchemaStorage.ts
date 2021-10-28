import {
    RegisteredSchemaIncompatibleError,
    SchemaCreationFailedError,
    SchemaStorage
} from "@domain/feature-gateway";
// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient, Schema as PrismaSchema} from "@cga/prisma";
import { Schema, SchemaInfo } from "@shared/util-schema";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Errors } from "io-ts";

export const createPrismaSchemaStorage = (
    createSchema: (
        info: SchemaInfo,
        schema: Record<string, unknown>
    ) => E.Either<Errors, Schema>,
    prisma: PrismaClient
): SchemaStorage => {
    const findSchema = (info: SchemaInfo) =>
        pipe(
            TO.tryCatch(() =>
                prisma.schema.findUnique({
                    where: { namespace_name_version: info },
                })
            ),
            TO.chain((entity) => TO.fromNullable(entity)),
            TO.chain((schemaEntity) =>
                TO.fromEither(
                    createSchema(
                        info,
                        schemaEntity.schemaObject as Record<string, unknown>
                    )
                )
            )
        );

    const storeSchema = (schema: Schema) => () =>
        TE.tryCatch(
            () =>
                prisma.schema.create({
                    data: {
                        ...schema.info,
                        schemaObject: schema.schemaObject,
                    },
                }),
            (e: Error) => SchemaCreationFailedError.create(e.message)
        );

    const prismaSchemaToSchema: (
        schema: PrismaSchema
    ) => E.Either<Errors, Schema> = (schema) =>
        createSchema(
            {
                namespace: schema.namespace,
                name: schema.name,
                version: schema.version,
            },
            schema.schemaObject as Record<string, unknown>
        );

    return {
        register: (schema: Schema) =>
            pipe(
                findSchema(schema.info),
                TE.fromTaskOption(() => undefined),
                TE.swap,
                TE.mapLeft(() =>
                    RegisteredSchemaIncompatibleError.create(schema.info)
                ),
                TE.chain(storeSchema(schema)),
                TE.map(() => undefined)
            ),
        find: findSchema,
        findAll: () => {
            return pipe(
                TO.tryCatch(() => prisma.schema.findMany({})),
                TO.chain((entities) => {
                    return TO.some(pipe(
                        entities.map(prismaSchemaToSchema),
                        A.filter(E.isRight),
                        A.map(item => item.right)
                    ));
                })
            );
        },
    };
};
