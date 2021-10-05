import * as E from "fp-ts/Either";
import { DataStorage, SchemaStorage } from "../adapter";
import { Payload, SchemaSnapshot } from "../types";

/**
 * Public API (facade) for the Content Gateway backend service that's responsible
 * for ingestion of data.
 */
export type ContentGateway = {
    /**
     * Registers a new schema shapshot with the Content Gateway.
     */
    register: <T>(schema: SchemaSnapshot<T>) => E.Either<Error, void>;
    /**
     * Ingests a new payload into the Content Gateway. The payload is validated
     * and it must correspond to a registered schema. If either the schema doesn't
     * exist or the payload is invalid according to the schema an error will be
     * returned.
     */
    receive: <T>(payload: Payload<T>) => E.Either<Error, void>;
};

export type ContentGatewayFactory = (
    schemaStorage: SchemaStorage,
    dataStorage: DataStorage
) => ContentGateway;

/**
 * Creates a new [[ContentGateway]] instance using the supplied
 * [[schemaStorage]] and [[dataStorage]].
 */
export const createContentGateway: ContentGatewayFactory = (
    schemaStorage: SchemaStorage,
    dataStorage: DataStorage
) => {
    return {
        register: <T>(schema: SchemaSnapshot<T>) => {
            return schemaStorage.register(schema);
        },
        receive: <T>(payload: Payload<T>) => {
            return dataStorage.store(payload);
        },
    };
};
