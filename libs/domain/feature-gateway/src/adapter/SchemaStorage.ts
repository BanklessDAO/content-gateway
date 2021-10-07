import { Schema, SchemaInfo, schemaInfoToKey } from "@shared/util-schema";
import * as E from "fp-ts/Either";

/**
 * The [[SchemaStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the schemas sent from the SDK.
 */
export type SchemaStorage = {
    register: (schema: Schema) => E.Either<Error, void>;
    find: (key: SchemaInfo) => E.Either<Error, Schema>;
    findAll(): Array<Schema>;
};

/**
 * This factory function creates a new [[SchemaStorage]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createInMemorySchemaStorage = (
    map: Map<string, Schema> = new Map()
): SchemaStorage => {
    return {
        register: (schema: Schema): E.Either<Error, void> => {
            const keyStr = schemaInfoToKey(schema.info);
            if (map.has(keyStr)) {
                return E.left(
                    new Error(`Schema with key ${keyStr} already registered`)
                );
            }
            map.set(keyStr, schema);
            return E.right(undefined);
        },
        find: (key: SchemaInfo): E.Either<Error, Schema> => {
            const keyStr = schemaInfoToKey(key);
            if (map.has(keyStr)) {
                return E.right(map.get(keyStr) as Schema);
            } else {
                return E.left(new Error(`Schema with key ${keyStr} not found`));
            }
        },
        findAll: (): Schema[] => {
            return Array.from(map.values());
        }
    };
};
