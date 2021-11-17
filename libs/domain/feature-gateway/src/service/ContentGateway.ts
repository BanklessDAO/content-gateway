import { createLogger } from "@shared/util-fp";
import { Schema } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DataStorage, SchemaStorage } from "../adapter";
import { Payload } from "../types";

/**
 * Represents the public API of the Content Gateway.
 */
export type ContentGateway = {
    /**
     * Registers a new schema shapshot with the Content Gateway.
     */
    register: (schema: Schema) => TE.TaskEither<Error, void>;
    /**
     * Ingests a new payload into the Content Gateway. The payload is validated
     * and it must correspond to a registered schema. If either the schema doesn't
     * exist or the payload is invalid according to the schema an error will be
     * returned.
     */
    receive: <T>(payload: Payload<T>) => TE.TaskEither<Error, string>;
    /**
     * Same as {@link receive} but for a batch of items.
     */
    receiveBatch: <T>(
        payload: Payload<Array<T>>
    ) => TE.TaskEither<Error, string>;
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
    const logger = createLogger("ContentGateway");
    return {
        register: (schema: Schema) => {
            return schemaStorage.register(schema);
        },
        receive: <T>(payload: Payload<T>) => {
            return pipe(
                dataStorage.store({
                    info: payload.info,
                    record: payload.data as Record<string, unknown>,
                }),
                TE.mapLeft((err) => {
                    logger.warn(`Failed to store batch of data:`, err);
                    return new Error(`Failed to store batch of data: ${err}`);
                }),
                TE.map(() => "OK")
            );
        },
        receiveBatch: <T>(payload: Payload<Array<T>>) => {
            const { info, data } = payload;

            return pipe(
                dataStorage.storeBulk({
                    info: info,
                    records: data as Record<string, unknown>[],
                }),
                TE.mapLeft((err) => {
                    logger.warn(`Failed to store batch of data:`, err);
                    return new Error(`Failed to store batch of data: ${err}`);
                }),
                TE.map(() => "OK")
            );
        },
    };
};
