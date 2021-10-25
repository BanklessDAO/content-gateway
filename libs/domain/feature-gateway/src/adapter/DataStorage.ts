/* eslint-disable @typescript-eslint/no-explicit-any */
import { SchemaInfo, schemaInfoToKey } from "@shared/util-schema";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { v4 as uuid } from "uuid";
import { Data } from "./Data";

/**
 * The [[DataStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the data received from the SDK.
 */
export type DataStorage = {
    store: (payload: Data) => TE.TaskEither<Error, string>;
    findBySchema: (key: SchemaInfo) => TO.TaskOption<Array<Data>>;
    findById: (id: string) => TO.TaskOption<Data>;
};

/**
 * This factory function creates a new [[DataStorage]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createInMemoryDataStorage = (
    map: Map<string, Data[]> = new Map()
): DataStorage => {
    const lookup = new Map<string, Data>();
    return {
        store: function (data: Data): TE.TaskEither<Error, string> {
            const keyStr = schemaInfoToKey(data.info);
            if (!map.has(keyStr)) {
                map.set(keyStr, []);
            }
            map.get(keyStr)?.push(data);
            const id = uuid();
            lookup.set(id, data);
            return TE.right(id);
        },
        findBySchema: function (key: SchemaInfo): TO.TaskOption<Array<Data>> {
            const keyStr = schemaInfoToKey(key);
            if (map.has(keyStr)) {
                return TO.fromNullable(map.get(keyStr));
            } else {
                return TO.of([]);
            }
        },
        findById: function (id: string): TO.TaskOption<Data> {
            return TO.fromNullable(lookup.get(id));
        },
    };
};
