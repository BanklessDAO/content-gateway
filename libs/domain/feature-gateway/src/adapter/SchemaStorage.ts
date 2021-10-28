import { Schema, SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";

export class RegisteredSchemaIncompatibleError extends Error {
    public _tag = "RegisteredSchemaIncompatibleError";

    private constructor(info: SchemaInfo) {
        super(`There is an incompatible registered schema with key ${schemaInfoToString(info)}`);
    }

    public static create(info: SchemaInfo): RegisteredSchemaIncompatibleError {
        return new RegisteredSchemaIncompatibleError(info);
    }
}

export class SchemaCreationFailedError extends Error {
    public _tag = "SchemaCreationFailedError";

    private constructor(message: string) {
        super(message);
    }

    public static create(message: string): SchemaCreationFailedError {
        return new SchemaCreationFailedError(message);
    }
}

export type SchemaStorageError =
    | RegisteredSchemaIncompatibleError
    | SchemaCreationFailedError;

/**
 * The [[SchemaStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the schemas sent from the SDK.
 */
export type SchemaStorage = {
    register: (schema: Schema) => TE.TaskEither<SchemaStorageError, void>;
    find: (key: SchemaInfo) => TO.TaskOption<Schema>;
    findAll(): TO.TaskOption<Array<Schema>>;
};

export type SchemaStorageStub = {
    storage: Map<string, Schema>
} & SchemaStorage;

/**
 * This factory function creates a new [[SchemaStorage]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createSchemaStorageStub = (
    map: Map<string, Schema> = new Map()
): SchemaStorageStub => {
    return {
        storage: map,
        register: (
            schema: Schema
        ): TE.TaskEither<SchemaStorageError, void> => {
            const keyStr = schemaInfoToString(schema.info);
            if (map.has(keyStr)) {
                return TE.left(
                    RegisteredSchemaIncompatibleError.create(schema.info)
                );
            }
            map.set(keyStr, schema);
            return TE.right(undefined);
        },
        find: (key: SchemaInfo): TO.TaskOption<Schema> => {
            const keyStr = schemaInfoToString(key);
            if (map.has(keyStr)) {
                return TO.some(map.get(keyStr) as Schema);
            } else {
                return TO.none;
            }
        },
        findAll: () => TO.some(Array.from(map.values())),
    };
};
