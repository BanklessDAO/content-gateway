import { Payload, Schema } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { BatchDataReceivingError } from ".";
import { DataRepository, SchemaRegistrationError, SchemaRepository, SchemaStat } from "..";
import { DataReceivingError } from "./errors";

/**
 * Represents the public API of the Content Gateway.
 */
export type ContentGateway = {
    loadStats: () => T.Task<Array<SchemaStat>>;
    /**
     * Registers a new schema shapshot with the Content Gateway.
     */
    register: (schema: Schema) => TE.TaskEither<SchemaRegistrationError, void>;
    /**
     * Ingests a new payload into the Content Gateway. The payload is validated
     * and it must correspond to a registered schema. If either the schema doesn't
     * exist or the payload is invalid according to the schema an error will be
     * returned.
     */
    receive: <T>(
        payload: Payload<T>
    ) => TE.TaskEither<DataReceivingError, void>;
    /**
     * Same as {@link receive} but for a batch of items.
     */
    receiveBatch: <T>(
        payload: Payload<Array<T>>
    ) => TE.TaskEither<BatchDataReceivingError, void>;
};

export type Deps = {
    schemaRepository: SchemaRepository;
    dataRepository: DataRepository;
};

/**
 * Creates a new {@link ContentGateway} instance.
 */
export const createContentGateway = ({
    schemaRepository,
    dataRepository,
}: Deps): ContentGateway => {
    return {
        loadStats: () => schemaRepository.loadStats(),
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
                    return new DataReceivingError(err);
                }),
                TE.map(() => undefined)
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
                    return new BatchDataReceivingError(err);
                }),
                TE.map(() => undefined)
            );
        },
    };
};
