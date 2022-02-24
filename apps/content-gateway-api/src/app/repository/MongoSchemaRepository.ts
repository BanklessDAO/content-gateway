// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { CodecValidationError, UnknownError } from "@banklessdao/util-data";
import {
    createSchemaFromObject,
    Schema,
    SchemaInfo,
    schemaInfoToString,
    stringToSchemaInfo
} from "@banklessdao/util-schema";
import {
    ContentGatewayUser,
    DatabaseError,
    RegisteredSchemaIncompatibleError,
    SchemaEntity,
    SchemaNotFoundError,
    SchemaRegistrationError,
    SchemaRemovalError,
    SchemaRepository,
    SchemaStat
} from "@domain/feature-gateway";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { Db } from "mongodb";
import { MongoSchema, mongoUserToCGUser, wrapDbOperation } from ".";

type Deps = {
    db: Db;
    schemasCollectionName: string;
    usersCollectionName: string;
};

export const createMongoSchemaRepository = async ({
    db,
    schemasCollectionName,
    usersCollectionName,
}: Deps): Promise<SchemaRepository> => {
    const schemas = db.collection<MongoSchema>(schemasCollectionName);

    // TODO! test if the index was created
    await schemas.createIndex({ key: 1 }, { unique: true });
    await schemas.createIndex({ userId: 1 });
    await schemas.createIndex({ createdAt: 1 });
    await schemas.createIndex({ updatedAt: 1 });

    const find = (
        info: SchemaInfo
    ): TE.TaskEither<
        SchemaNotFoundError | CodecValidationError,
        SchemaEntity
    > => {
        return pipe(
            TE.tryCatch(
                async () => {
                    return schemas
                        .aggregate<MongoSchema>([
                            {
                                $match: { key: schemaInfoToString(info) },
                            },
                            {
                                $limit: 1,
                            },
                            {
                                $project: {
                                    key: true,
                                    jsonSchema: true,
                                    createdAt: true,
                                    updatedAt: true,
                                    deletedAt: true,
                                },
                            },
                            {
                                $lookup: {
                                    from: usersCollectionName,
                                    localField: "ownerId",
                                    foreignField: "userId",
                                    as: "users",
                                },
                            },
                            {
                                $project: {
                                    key: true,
                                    jsonSchema: true,
                                    createdAt: true,
                                    updatedAt: true,
                                    deletedAt: true,
                                    owner: { $first: "$users" },
                                },
                            },
                        ])
                        .toArray();
                },
                (e) => {
                    return new SchemaNotFoundError(info);
                }
            ),
            TE.chain((arr) => {
                if (arr.length === 0) {
                    return TE.left(new SchemaNotFoundError(info));
                } else {
                    // ! TODO: what should we do if the owner is no longer present?
                    return TE.right(arr[0]);
                }
            }),
            TE.chainW((mongoSchema) => {
                return pipe(
                    createSchemaFromObject({
                        info: info,
                        jsonSchema: mongoSchema.jsonSchema,
                    }),
                    TE.fromEither,
                    TE.map((schema) => ({
                        ...schema,
                        owner: mongoUserToCGUser(mongoSchema.owner),
                    }))
                );
            })
        );
    };

    const register = (
        schema: Schema,
        owner: ContentGatewayUser
    ): TE.TaskEither<SchemaRegistrationError, void> => {
        return pipe(
            find(schema.info),
            TE.getOrElse(() => {
                return T.of({
                    ...schema,
                    owner,
                });
            }),
            TE.fromTask,
            TE.mapLeft((e: unknown) => new UnknownError(e)),
            TE.chainW((oldSchema) => {
                let result: TE.TaskEither<SchemaRegistrationError, MongoSchema>;
                if (schema.isBackwardCompatibleWith(oldSchema)) {
                    result = upsertSchema({
                        ...schema,
                        owner,
                    });
                } else {
                    result = TE.left(
                        new RegisteredSchemaIncompatibleError(schema.info)
                    );
                }
                return result;
            }),
            TE.map(() => {
                return undefined;
            })
        );
    };

    const remove = (
        schema: SchemaEntity
    ): TE.TaskEither<SchemaRemovalError, void> => {
        const schemaKey = schemaInfoToString(schema.info);
        return pipe(
            wrapDbOperation(() => {
                return schemas.deleteOne({
                    key: schemaKey,
                });
            })(),
            TE.chain(() =>
                wrapDbOperation(() => {
                    return db.dropCollection(schemaKey);
                })()
            ),
            TE.map(() => undefined)
        );
    };

    const loadStats = (): T.Task<Array<SchemaStat>> => {
        return pipe(
            findAll(),
            T.chain((allSchemas) => {
                return async () => {
                    const stats = [] as SchemaStat[];
                    for (const schema of allSchemas) {
                        const info = schema.info;
                        const name = schemaInfoToString(info);
                        const coll = db.collection(name);
                        const rowCount = await coll.countDocuments();
                        const lastDocument = await coll.findOne(
                            {},
                            { sort: { updatedAt: "desc" } }
                        );
                        const lastUpdated =
                            lastDocument?.updatedAt ?? new Date(0);
                        stats.push({ info, rowCount, lastUpdated });
                    }
                    return stats;
                };
            })
        );
    };

    const upsertSchema = (
        schema: SchemaEntity
    ): TE.TaskEither<DatabaseError, MongoSchema> => {
        const collectionName = schemaInfoToString(schema.info);
        return pipe(
            wrapDbOperation(() => {
                return schemas.findOneAndUpdate(
                    {
                        key: schemaInfoToString(schema.info),
                    },
                    {
                        $set: {
                            jsonSchema: schema.jsonSchema,
                            updatedAt: new Date(),
                        },
                        $setOnInsert: {
                            key: collectionName,
                            createdAt: new Date(),
                            ownerId: schema.owner.id,
                        },
                    },
                    {
                        upsert: true,
                        returnDocument: "after",
                    }
                );
            })(),
            TE.chain((result) => {
                if (result.value) {
                    return TE.of(result.value);
                } else {
                    return TE.left(
                        new DatabaseError(new Error("Upsert result was null."))
                    );
                }
            }),
            TE.chainFirst(() => {
                // TODO! test if the index was created
                return wrapDbOperation(() => {
                    return db
                        .collection(collectionName)
                        .createIndex({ id: 1 }, { unique: true });
                })();
            })
        );
    };

    const mongoSchemaToSchema: (
        schema: MongoSchema
    ) => E.Either<CodecValidationError, SchemaEntity> = (schema) => {
        return pipe(
            createSchemaFromObject({
                info: stringToSchemaInfo(schema.key),
                jsonSchema: schema.jsonSchema,
            }),
            E.map((s) => {
                return {
                    ...s,
                    owner: mongoUserToCGUser(schema.owner),
                };
            })
        );
    };

    const findAll = (): T.Task<Array<SchemaEntity>> => {
        return pipe(
            async () => {
                return schemas
                    .aggregate<MongoSchema>([
                        {
                            $project: {
                                key: true,
                                jsonSchema: true,
                                createdAt: true,
                                updatedAt: true,
                                deletedAt: true,
                            },
                        },
                        {
                            $lookup: {
                                from: usersCollectionName,
                                localField: "ownerId",
                                foreignField: "userId",
                                as: "users",
                            },
                        },
                        {
                            $project: {
                                key: true,
                                jsonSchema: true,
                                createdAt: true,
                                updatedAt: true,
                                deletedAt: true,
                                owner: { $first: "$users" },
                            },
                        },
                    ])
                    .toArray();
            },
            T.map((entities) => {
                return pipe(
                    entities.map(mongoSchemaToSchema),
                    A.filter(E.isRight),
                    A.map((item) => item.right)
                );
            })
        );
    };

    return {
        register,
        remove,
        find,
        findAll,
        loadStats,
    };
};
