import { UnknownError } from "@shared/util-dto";
import { Schema, SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { DatabaseError, RegisteredSchemaIncompatibleError } from ".";

export type SchemaRegistrationError =
    | UnknownError
    | DatabaseError
    | RegisteredSchemaIncompatibleError;

export type SchemaRemovalError = UnknownError | DatabaseError;

export type SchemaStat = {
    info: SchemaInfo;
    rowCount: number;
    lastUpdated: number;
};

/**
 * The [[SchemaRepository]] is a server-side component of the content gateway.
 * It is responsible for storing the schemas sent from the SDK.
 */
export type SchemaRepository = {
    register: (schema: Schema) => TE.TaskEither<SchemaRegistrationError, void>;
    remove: (info: SchemaInfo) => TE.TaskEither<SchemaRemovalError, void>;
    find: (key: SchemaInfo) => TO.TaskOption<Schema>;
    findAll: () => T.Task<Array<Schema>>;
    loadStats(): T.Task<Array<SchemaStat>>;
};

export type SchemaRepositoryStub = {
    storage: Map<string, Schema>;
} & SchemaRepository;

/**
 * This factory function creates a new [[SchemaRepository]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createSchemaRepositoryStub = (
    map: Map<string, Schema> = new Map()
): SchemaRepositoryStub => {
    return {
        storage: map,
        register: (
            schema: Schema
        ): TE.TaskEither<SchemaRegistrationError, void> => {
            const keyStr = schemaInfoToString(schema.info);
            map.set(keyStr, schema);
            return TE.right(undefined);
        },
        remove: (info: SchemaInfo): TE.TaskEither<SchemaRemovalError, void> => {
            const keyStr = schemaInfoToString(info);
            map.delete(keyStr);
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
        findAll: () => T.of(Array.from(map.values())),
        loadStats: () => T.of([]),
    };
};
