import { SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { Payload } from "../types/Payload";

/**
 * The [[DataStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the data received from the SDK.
 */
export type DataStorage = {
    store: <T>(payload: Payload<T>) => E.Either<Error, void>;
    find: <T>(key: SchemaInfo) => T[];
};

/**
 * This factory function creates a new [[DataStorage]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createInMemoryDataStorage = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    map: Map<string, any[]> = new Map()
): DataStorage => {
    return {
        store: function <T>(payload: Payload<T>): E.Either<Error, void> {
            const keyStr = schemaInfoToString(payload.key);
            if (!map.has(keyStr)) {
                map.set(keyStr, []);
            }
            map.get(keyStr)?.push(payload.data);
            return E.right(undefined);
        },
        find: function <T>(key: SchemaInfo): T[] {
            const keyStr = schemaInfoToString(key);
            if (map.has(keyStr)) {
                return [...(map?.get(keyStr) ?? [])];
            } else {
                return [];
            }
        },
    };
};
