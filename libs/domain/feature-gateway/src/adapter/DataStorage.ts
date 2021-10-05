import * as E from "fp-ts/Either";
import { Payload } from "../types/Payload";
import { keyToString, TypeKey } from "@shared/util-schema";

/**
 * The [[DataStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the data received from the SDK.
 */
export type DataStorage = {
    store: <T>(payload: Payload<T>) => E.Either<Error, void>;
    find: <T>(key: TypeKey<T>) => T[];
};

/**
 * This factory function creates a new [[DataStorage]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createInMemoryDataStorage = (
    map: Map<string, any[]> = new Map()
): DataStorage => {
    return {
        store: function <T>(payload: Payload<T>): E.Either<Error, void> {
            const keyStr = keyToString(payload.key);
            if (!map.has(keyStr)) {
                map.set(keyStr, []);
            }
            map.get(keyStr)?.push(payload.data);
            return E.right(undefined);
        },
        find: function <T>(key: TypeKey<T>): T[] {
            const keyStr = keyToString(key);
            if (map.has(keyStr)) {
                return [...(map?.get(keyStr) ?? [])];
            } else {
                return [];
            }
        },
    };
};
