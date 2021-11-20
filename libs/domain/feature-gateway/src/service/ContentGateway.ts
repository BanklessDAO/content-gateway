import { createLogger } from "@shared/util-fp";
import { Payload, Schema } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DataRepository, SchemaRepository } from "../repository";

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
    schemaRepository: SchemaRepository,
    dataRepository: DataRepository
) => ContentGateway;

/**
 * Creates a new [[ContentGateway]] instance using the supplied
 * [[schemaRepository]] and [[dataRepository]].
 */
export const createContentGateway: ContentGatewayFactory = (
    schemaRepository: SchemaRepository,
    dataRepository: DataRepository
) => {
    const logger = createLogger("ContentGateway");
    return {
        register: (schema: Schema) => {
            return schemaRepository.register(schema);
        },
        receive: <T>(payload: Payload<T>) => {
            const { info, data } = payload;
            return pipe(
                dataRepository.store({
                    info: info,
                    record: data as Record<string, unknown>,
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
                dataRepository.storeBulk({
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
