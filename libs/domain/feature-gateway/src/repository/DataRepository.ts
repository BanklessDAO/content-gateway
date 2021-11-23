/* eslint-disable @typescript-eslint/no-explicit-any */
import { SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { DatabaseError, MissingSchemaError, SchemaValidationError } from ".";

export type SinglePayload = {
    info: SchemaInfo;
    record: Record<string, unknown>;
};

export type ListPayload = {
    info: SchemaInfo;
    records: Record<string, unknown>[];
};

export type Entry = {
    id: bigint;
    record: Record<string, unknown>;
};

export type EntryWithInfo = {
    info: SchemaInfo;
} & Entry;

export type EntryList = {
    info: SchemaInfo;
    entries: Entry[];
};

export type SchemaFilter = {
    cursor?: bigint;
    limit: number;
    info: SchemaInfo;
};

export const FilterType = {
    equals: "equals",
    not: "not",
    contains: "contains",
    starts_with: "starts_with",
    ends_with: "ends_with",
    lt: "lt",
    lte: "lte",
    gt: "gt",
    gte: "gte",
} as const;

export type FilterType = keyof typeof FilterType;

export type Filter = {
    type: FilterType;
    fieldPath: string[];
    value: unknown;
};

export type OrderDirection = "asc" | "desc";

export type OrderBy = Record<string, OrderDirection>;

export type Query = {
    info: SchemaInfo;
    limit: number;
    cursor?: bigint;
    where?: Filter[];
    orderBy?: OrderBy;
};

export type DataStorageError =
    | MissingSchemaError
    | SchemaValidationError
    | DatabaseError;

/**
 * The [[DataRepository]] is a server-side component of the content gateway.
 * It is responsible for storing the data received from the SDK.
 */
export type DataRepository = {
    store: (
        entry: SinglePayload
    ) => TE.TaskEither<DataStorageError, EntryWithInfo>;
    storeBulk: (
        entryList: ListPayload
    ) => TE.TaskEither<DataStorageError, EntryList>;
    findById: (id: bigint) => TO.TaskOption<EntryWithInfo>;
    findBySchema: (
        filter: SchemaFilter
    ) => TE.TaskEither<DatabaseError, EntryList>;
    findByQuery: (query: Query) => TE.TaskEither<DatabaseError, EntryList>;
};

export type DataRepositoryStub = {
    storage: Map<string, Entry[]>;
} & DataRepository;

/**
 * This factory function creates a new [[DataRepository]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createDataRepositoryStub = (
    map: Map<string, Entry[]> = new Map()
): DataRepositoryStub => {
    let counter = 1;

    const store = (
        singlePayload: SinglePayload
    ): TE.TaskEither<DataStorageError, EntryWithInfo> => {
        const keyStr = schemaInfoToString(singlePayload.info);
        if (!map.has(keyStr)) {
            map.set(keyStr, []);
        }
        const entry = {
            id: BigInt(counter),
            info: singlePayload.info,
            record: singlePayload.record,
        };
        counter++;
        map.get(keyStr)?.push(entry);
        return TE.right(entry);
    };

    return {
        storage: map,
        store: store,
        storeBulk: (
            listPayload: ListPayload
        ): TE.TaskEither<DataStorageError, EntryList> => {
            const { info, records } = listPayload;
            return pipe(
                records,
                A.map((record) => store({ info, record })),
                TE.sequenceArray,
                TE.map((entries) => ({
                    info,
                    entries: [...entries],
                }))
            );
        },
        findById: (): TO.TaskOption<EntryWithInfo> => TO.none,
        findBySchema: (filter: SchemaFilter) =>
            TE.of({ info: filter.info, entries: [] }),
        findByQuery: (filter: Query) =>
            TE.of({ info: filter.info, entries: [] }),
    };
};
