/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    SchemaInfo,
    schemaInfoToString,
    ValidationError,
} from "@shared/util-schema";
import { LoadContext } from "@shared/util-loaders";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";

export type Data = {
    info: SchemaInfo;
    record: Record<string, unknown>;
};

export type StoredData = {
    id: bigint;
} & Data;

export type BulkData = {
    info: SchemaInfo;
    records: Record<string, unknown>[];
};

export type DataEntry = {
    id: bigint;
    record: Record<string, unknown>;
};

export type StoredBulkData = {
    info: SchemaInfo;
    entries: DataEntry[];
};

export type SchemaFilter = {
    cursor?: bigint;
    limit: number;
    info: SchemaInfo;
};

export type Filters = LoadContext & {
    info: SchemaInfo;
};

export class DataValidationError extends Error {
    public _tag = "DataValidationError";
    public errors: ValidationError[];

    constructor(errors: ValidationError[]) {
        super(
            "Validation failed: " +
                errors.map((it) => `${it.message}: ${it.message}`).join("\n")
        );
        this.errors = errors;
    }
}

export class DatabaseStorageError extends Error {
    public _tag = "DatabaseError";
    public cause: Error;

    constructor(cause: Error) {
        super(`Failed to store data: ${cause.message}`);
        this.cause = cause;
    }
}

export class MissingSchemaError extends Error {
    public _tag = "MissingSchemaError";
    public info: SchemaInfo;

    constructor(info: SchemaInfo) {
        super(`No schema found by info: ${schemaInfoToString(info)}`);
        this.info = info;
    }
}

export type StorageError =
    | DataValidationError
    | DatabaseStorageError
    | MissingSchemaError;

/**
 * The [[DataStorage]] is a server-side component of the content gateway.
 * It is responsible for storing the data received from the SDK.
 */
export type DataStorage = {
    store: (data: Data) => TE.TaskEither<StorageError, StoredData>;
    storeBulk: (
        bulkData: BulkData
    ) => TE.TaskEither<StorageError, StoredBulkData>;
    findById: (id: bigint) => TO.TaskOption<StoredData>;
    findBySchema: (key: SchemaFilter) => T.Task<StoredData[]>;
    findByFilters: (filters: Filters) => T.Task<StoredData[]>;
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

    const store = (data: Data): TE.TaskEither<StorageError, StoredData> => {
        const keyStr = schemaInfoToString(data.info);
        if (!map.has(keyStr)) {
            map.set(keyStr, []);
        }
        counter++;
        const storedData = { ...data, id: counter };
        map.get(keyStr)?.push(storedData);
        lookup.set(counter, storedData);
        return TE.right(storedData);
    };

    return {
        storage: map,
        store: store,
        storeBulk: (
            data: BulkData
        ): TE.TaskEither<StorageError, StoredBulkData> => {
            const { info, records } = data;
            return pipe(
                records,
                A.map((record) => {
                    return store({ info, record });
                }),
                TE.sequenceArray,
                TE.map((storedData) => {
                    return {
                        info: info,
                        entries: storedData.map((item) => {
                            return {
                                id: item.id,
                                record: item.record,
                            };
                        }),
                    };
                })
            );
        },
        findById: () => TO.none,
        findBySchema: () => T.of([]),
        findByFilters: () => T.of([]),
    };
};
