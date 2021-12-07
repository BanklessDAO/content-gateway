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
    _id: string;
    id: string;
    record: Record<string, unknown>;
};

export type EntryList = {
    info: SchemaInfo;
    entries: Entry[];
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

export type OrderDirection = "asc" | "desc";

export type OrderBy = {
    fieldPath: string;
    direction: OrderDirection;
};

export type FilterType = keyof typeof FilterType;

export type Filter = {
    type: FilterType;
    fieldPath: string;
    value: unknown;
};

export type Query = {
    info: SchemaInfo;
    limit: number;
    cursor?: string;
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
    store: (entry: SinglePayload) => TE.TaskEither<DataStorageError, void>;
    storeBulk: (
        entryList: ListPayload
    ) => TE.TaskEither<DataStorageError, void>;
    findById: (info: SchemaInfo, id: string) => TO.TaskOption<Entry>;
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
    ): TE.TaskEither<DataStorageError, void> => {
        const keyStr = schemaInfoToString(singlePayload.info);
        if (!map.has(keyStr)) {
            map.set(keyStr, []);
        }
        const entry = {
            _id: `${counter}`,
            id: `${counter}`,
            info: singlePayload.info,
            record: singlePayload.record,
        };
        counter++;
        map.get(keyStr)?.push(entry);
        return TE.right(undefined);
    };

    return {
        storage: map,
        store: store,
        storeBulk: (
            listPayload: ListPayload
        ): TE.TaskEither<DataStorageError, void> => {
            const { info, records } = listPayload;
            return pipe(
                records,
                A.map((record) => store({ info, record })),
                TE.sequenceArray,
                TE.map(() => undefined)
            );
        },
        findById: (): TO.TaskOption<Entry> => TO.none,
        findByQuery: (filter: Query) =>
            TE.of({ info: filter.info, entries: [] }),
    };
};
