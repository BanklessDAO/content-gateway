import { CodecValidationError, UnknownError } from "@banklessdao/util-data";
import {
    Schema,
    SchemaInfo,
    schemaInfoToString
} from "@banklessdao/util-schema";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import {
    ContentGatewayUser,
    DatabaseError,
    RegisteredSchemaIncompatibleError,
    SchemaNotFoundError
} from ".";
import { SchemaEntity } from "./SchemaEntity";

export type SchemaRegistrationError =
    | UnknownError
    | DatabaseError
    | CodecValidationError
    | RegisteredSchemaIncompatibleError;

export type SchemaRemovalError = UnknownError | DatabaseError;

export type SchemaStat = {
    info: SchemaInfo;
    rowCount: number;
    lastUpdated: number;
};

/**
 * The [[SchemaRepository]] is a server-side component of the content gateway.
 * It is responsible for storing the schemas sent from the SDK.
 */
export type SchemaRepository = {
    find: (
        key: SchemaInfo
    ) => TE.TaskEither<
        SchemaNotFoundError | CodecValidationError,
        SchemaEntity
    >;
    findAll: () => T.Task<Array<SchemaEntity>>;
    register: (
        schema: Schema,
        owner: ContentGatewayUser
    ) => TE.TaskEither<SchemaRegistrationError, void>;
    remove: (schema: SchemaEntity) => TE.TaskEither<SchemaRemovalError, void>;
    loadStats(): T.Task<Array<SchemaStat>>;
};

export type SchemaRepositoryMock = {
    storage: Map<string, Schema>;
} & SchemaRepository;

/**
 * This factory function creates a new [[SchemaRepository]] instance that will
 * use the supplied [[map]] as the storage. This is useful for testing.
 */
export const createSchemaRepositoryStub = (
    map: Map<string, SchemaEntity> = new Map()
): SchemaRepositoryMock => {
    return {
        storage: map,
        register: (
            schema: Schema,
            owner: ContentGatewayUser
        ): TE.TaskEither<SchemaRegistrationError, void> => {
            const keyStr = schemaInfoToString(schema.info);
            const se = {
                ...schema,
                owner,
            };
            map.set(keyStr, se);
            return TE.right(undefined);
        },
        remove: (
            entity: SchemaEntity
        ): TE.TaskEither<SchemaRemovalError, void> => {
            const keyStr = schemaInfoToString(entity.info);
            map.delete(keyStr);
            return TE.right(undefined);
        },
        find: (
            key: SchemaInfo
        ): TE.TaskEither<
            SchemaNotFoundError | CodecValidationError,
            SchemaEntity
        > => {
            const keyStr = schemaInfoToString(key);
            if (map.has(keyStr)) {
                return TE.right(map.get(keyStr) as SchemaEntity);
            } else {
                return TE.left(new SchemaNotFoundError(key));
            }
        },
        findAll: () => T.of(Array.from(map.values())),
        loadStats: () => T.of([]),
    };
};
