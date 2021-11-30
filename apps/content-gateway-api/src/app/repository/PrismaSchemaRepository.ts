// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient, Schema as PrismaSchema } from "@cga/prisma";
import {
    DatabaseError,
    RegisteredSchemaIncompatibleError,
    SchemaRegistrationError,
    SchemaRepository,
    UnknownError,
} from "@domain/feature-gateway";
import { CodecValidationError } from "@shared/util-dto";
import { createLogger } from "@shared/util-fp";
import {
    createSchemaFromObject,
    Schema,
    SchemaInfo,
} from "@shared/util-schema";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { wrapPrismaOperation } from ".";

export const createPrismaSchemaRepository = (
    prisma: PrismaClient
): SchemaRepository => {
    const logger = createLogger("PrismaSchemaRepository");
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

    const upsertSchema: (
        params: Schema
    ) => TE.TaskEither<DatabaseError, PrismaSchema> = wrapPrismaOperation(
        (schema: Schema) => {
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
        }
    );

    const prismaSchemaToSchema: (
        schema: PrismaSchema
    ) => E.Either<CodecValidationError, Schema> = (schema) =>
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
                    (e: unknown) => new UnknownError(e)
                ),
                TE.chainW((oldSchema) => {
                    let result: TE.TaskEither<
                        SchemaRegistrationError,
                        PrismaSchema
                    >;
                    if (schema.isBackwardCompatibleWith(oldSchema)) {
                        result = upsertSchema(schema);
                    } else {
                        result = TE.left(
                            new RegisteredSchemaIncompatibleError(schema.info)
                        );
                    }
                    return result;
                }),
                TE.map(() => undefined)
            );
        },
        find: findSchema,
        findAll: () => {
            return pipe(
                async () => {
                    // * this can fail on paper, but if there is no database connection
                    // * 👇 then we have bigger problems
                    return prisma.schema.findMany();
                },
                T.map((entities) => {
                    return pipe(
                        entities.map(prismaSchemaToSchema),
                        A.filter(E.isRight),
                        A.map((item) => item.right)
                    );
                })
            );
        },
        loadStats: () => {
            return pipe(
                async () => {
                    return prisma.data.groupBy({
                        by: ["namespace", "name", "version"],
                        _count: {
                            _all: true,
                        },
                        _max: {
                            createdAt: true,
                        },
                    });
                },
                T.map((stats) => {
                    return stats.map((stat) => {
                        const { namespace, name, version } = stat;
                        return {
                            info: { namespace, name, version },
                            rowCount: stat._count._all,
                            lastUpdated: (stat._max.createdAt ?? new Date()).getTime(),
                        };
                    });
                })
            );
        },
    };
};
