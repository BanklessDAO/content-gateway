/* eslint-disable @typescript-eslint/no-explicit-any */
import { SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import { LoadContext } from "@shared/util-loaders";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Data } from "./Data";

export type SchemaFilter = {
    cursor?: bigint;
    limit: number;
    info: SchemaInfo;
};

export type Filters = LoadContext & {
    info: SchemaInfo
};

/**
 * The [[DataStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the data received from the SDK.
 */
export type DataStorage = {
    store: (payload: Data) => TE.TaskEither<Error, Data>;
    findById: (id: bigint) => TO.TaskOption<Data>;
    findBySchema: (key: SchemaFilter) => T.Task<Array<Data>>;
    findByFilters: (filters: Filters) => T.Task<Array<Data>>;
};

export type DataStorageStub = {
    storage: Map<string, Data[]>;
} & DataStorage;

/**
 * This factory function creates a new [[DataStorage]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createDataStorageStub = (
    map: Map<string, Data[]> = new Map()
): DataStorageStub => {
    const lookup = new Map<bigint, Data>();
    let counter = BigInt(0);
    return {
        storage: map,
        store: (data: Data): TE.TaskEither<Error, Data> => {
            const keyStr = schemaInfoToString(data.info);
            if (!map.has(keyStr)) {
                map.set(keyStr, []);
            }
            map.get(keyStr)?.push(data);
            counter++;
            data.id = counter;
            lookup.set(counter, data);
            return TE.right(data);
        },
        findById: () => TO.none,
        findBySchema: () => T.of([]),
        findByFilters: () => T.of([]),
    };
};
