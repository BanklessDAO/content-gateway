/* eslint-disable @typescript-eslint/no-explicit-any */
import { SchemaInfo, schemaInfoToString } from "@shared/util-schema";
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
    filterByFieldValue: (field: string, value: any) => TO.TaskOption<Array<Data>>;
    filterByFieldContainingValue: (field: string, value: any) => TO.TaskOption<Array<Data>>;
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
    const lookup = new Map<string, Data>();
    return {
        storage: map,
        store: function (data: Data): TE.TaskEither<Error, string> {
            const keyStr = schemaInfoToString(data.info);
            if (!map.has(keyStr)) {
                map.set(keyStr, []);
            }
            map.get(keyStr)?.push(data);
            const id = uuid();
            lookup.set(id, data);
            return TE.right(id);
        },
        findBySchema: function (key: SchemaInfo): TO.TaskOption<Array<Data>> {
            const keyStr = schemaInfoToString(key);
            if (map.has(keyStr)) {
                return TO.fromNullable(map.get(keyStr));
            } else {
                return TO.of([]);
            }
        },
        findById: function (id: string): TO.TaskOption<Data> {
            return TO.fromNullable(lookup.get(id));
        },
        filterByFieldValue: function (field: string, value: any): TO.TaskOption<Array<Data>> {
            let filtered = Array.from(lookup.values())
                .filter(item => {
                    if (item.data[field] === null) { return false }
                    if (item.data[field] != value) { return false }
                    return true
                })

            return TO.fromNullable(filtered);
        },
        filterByFieldContainingValue: function (field: string, value: any): TO.TaskOption<Array<Data>> {
            let filtered = Array.from(lookup.values())
                .filter(item => {
                    if (item.data[field] === null) { return false }
                    return (item.data[field] as string).includes(value)
                })

            return TO.fromNullable(filtered);
        },
    };
};
