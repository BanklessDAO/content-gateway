import * as E from "fp-ts/Either";
import { TypeKey, keyToString } from "@shared/util-schema";
import {SchemaSnapshot} from "../types/SchemaSnapshot";

/**
 * The [[SchemaStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the schemas sent from the SDK.
 */
export type SchemaStorage = {
    register: <T>(schema: SchemaSnapshot<T>) => E.Either<Error, void>;
    find: <T>(key: TypeKey<T>) => E.Either<Error, SchemaSnapshot<T>>;
};

/**
 * This factory function creates a new [[SchemaStorage]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createInMemorySchemaStorage = (
    map: Map<string, SchemaSnapshot<any>> = new Map()
): SchemaStorage => {
    return {
        register: function <T>(
            schema: SchemaSnapshot<T>
        ): E.Either<Error, void> {
            const keyStr = keyToString(schema.key);
            if (map.has(keyStr)) {
                return E.left(
                    new Error(`Schema with key ${keyStr} already registered`)
                );
            }
            map.set(keyStr, schema);
            return E.right(undefined);
        },
        find: function <T>(key: TypeKey<T>): E.Either<Error, SchemaSnapshot<T>> {
            const keyStr = keyToString(key);
            if (map.has(keyStr)) {
                return E.right(map.get(keyStr) as SchemaSnapshot<T>);
            } else {
                return E.left(new Error(`Schema with key ${keyStr} not found`));
            }
        },
    };
};
