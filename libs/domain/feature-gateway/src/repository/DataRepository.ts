/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    CodecValidationError,
    mapCodecValidationError,
} from "@banklessdao/util-data";
import { base64Decode, base64Encode } from "@banklessdao/util-misc";
import { SchemaInfo, schemaInfoToString } from "@banklessdao/util-schema";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import * as t from "io-ts";
import { DatabaseError, SchemaNotFoundError, SchemaValidationError } from ".";

export type SinglePayload = {
    info: SchemaInfo;
    record: Record<string, unknown>;
};

export type ListPayload = {
    info: SchemaInfo;
    records: Record<string, unknown>[];
};

export type Entry = {
    id: string;
    record: Record<string, unknown>;
};

export type EntryList = {
    info: SchemaInfo;
    entries: Entry[];
    nextPageToken?: string;
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

const cursorCodec = t.intersection([
    t.strict({
        _id: t.string,
        dir: t.union([t.literal("asc"), t.literal("desc")]),
    }),
    t.exact(
        t.partial({
            custom: t.strict({
                fieldPath: t.string,
                value: t.string,
            }),
        })
    ),
]);

export type Cursor = t.TypeOf<typeof cursorCodec>;

export const encodeCursor = (cursor: Cursor): string => {
    return base64Encode(JSON.stringify(cursor));
};

export const decodeCursor = (
    cursor: string
): E.Either<CodecValidationError, Cursor> => {
    return pipe(
        E.tryCatch(
            () => base64Decode(cursor),
            () => [
                {
                    value: cursor,
                    context: [],
                    message: "Invalid cursor",
                },
            ]
        ),
        E.chain((cursorStr) => cursorCodec.decode(JSON.parse(cursorStr))),
        mapCodecValidationError("Can't decode cursor")
    );
};

export type Query = {
    info: SchemaInfo;
    limit: number;
    cursor?: string;
    where?: Filter[];
    orderBy?: OrderBy;
};

export type DataStorageError =
    | SchemaNotFoundError
    | CodecValidationError
    | SchemaValidationError
    | DatabaseError;

export type QueryError = CodecValidationError | DatabaseError;

/**
 * The [[DataRepository]] is a server-side component of the content gateway.
 * It is responsible for storing the data received from the SDK.
 */
export type DataRepository = {
    store: (entryList: ListPayload) => TE.TaskEither<DataStorageError, void>;
    findById: (info: SchemaInfo, id: string) => TO.TaskOption<Entry>;
    findByQuery: (query: Query) => TE.TaskEither<QueryError, EntryList>;
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
        store: (
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
