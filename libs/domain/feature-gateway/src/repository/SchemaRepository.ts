import { Schema, SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { SchemaRepositoryError } from ".";

/**
 * The [[SchemaRepository]] is a server-side component of the content gateway.
 * It is responsible for storing the schemas sent from the SDK.
 */
export type SchemaRepository = {
    register: (schema: Schema) => TE.TaskEither<SchemaRepositoryError, void>;
    find: (key: SchemaInfo) => TO.TaskOption<Schema>;
    // TODO: make this a Task instead
    findAll: () => T.Task<Array<Schema>>;
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
        ): TE.TaskEither<SchemaRepositoryError, void> => {
            const keyStr = schemaInfoToString(schema.info);
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
        findAll: () => T.of(Array.from(map.values())),
    };
};
