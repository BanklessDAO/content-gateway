// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import {
    DatabaseError,
    RegisteredSchemaIncompatibleError,
    SchemaRegistrationError,
    SchemaRemovalError,
    SchemaRepository,
    SchemaStat
} from "@domain/feature-gateway";
import { CodecValidationError, UnknownError } from "@shared/util-dto";
import {
    createSchemaFromObject,
    Schema,
    SchemaInfo,
    schemaInfoToString,
    stringToSchemaInfo
} from "@shared/util-schema";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { MongoClient } from "mongodb";
import { MongoSchema, wrapDbOperation } from ".";

export const SCHEMAS_COLLECTION_NAME = "schemas";

export const createMongoSchemaRepository = async ({
    dbName,
    mongoClient,
}: {
    dbName: string;
    mongoClient: MongoClient;
}): Promise<SchemaRepository> => {
    const schemas = mongoClient
        .db(dbName)
        .collection<MongoSchema>(SCHEMAS_COLLECTION_NAME);

    // TODO! test if the index was created
    await schemas.createIndex({ key: 1 }, { unique: true });

    const findSchema = (info: SchemaInfo) => {
        return pipe(
            TO.tryCatch(() => {
                return schemas.findOne({ key: schemaInfoToString(info) });
            }),
            TO.chain((entity) => TO.fromNullable(entity)),
            TO.chain((schemaEntity) => {
                return TO.fromEither(
                    createSchemaFromObject({
                        info: info,
                        jsonSchema: schemaEntity.jsonSchema,
                    })
                );
            })
        );
    };

    const upsertSchema = (
        schema: Schema
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
                return wrapDbOperation(async () => {
                    const db = mongoClient.db(dbName);
                    return db
                        .collection(collectionName)
                        .createIndex({ id: 1 }, { unique: true });
                })();
            })
        );
    };

    const mongoSchemaToSchema: (
        schema: MongoSchema
    ) => E.Either<CodecValidationError, Schema> = (schema) =>
        createSchemaFromObject({
            info: stringToSchemaInfo(schema.key),
            jsonSchema: schema.jsonSchema,
        });

    return {
        register: (
            schema: Schema
        ): TE.TaskEither<SchemaRegistrationError, void> => {
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
                        MongoSchema
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
        remove: (info: SchemaInfo): TE.TaskEither<SchemaRemovalError, void> => {
            return pipe(
                wrapDbOperation(() => {
                    return schemas.deleteOne({
                        key: schemaInfoToString(info),
                    });
                })(),
                TE.map(() => undefined)
            );
        },
        find: findSchema,
        findAll: (): T.Task<Array<Schema>> => {
            return pipe(
                async () => {
                    // * this can fail on paper, but if there is no database connection
                    // * 👇 then we have bigger problems
                    return schemas.find().toArray();
                },
                T.map((entities) => {
                    return pipe(
                        entities.map(mongoSchemaToSchema),
                        A.filter(E.isRight),
                        A.map((item) => item.right)
                    );
                })
            );
        },
        loadStats: (): T.Task<Array<SchemaStat>> => {
            // TODO!
            return T.of([]);
        },
    };
};
