/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BatchPayloadJson,
    createSchemaFromType,
    PayloadJson,
    Schema,
    SchemaInfo,
    schemaInfoToString,
    SchemaJson,
    ValidationError,
} from "@shared/util-schema";
import { isArray, Type } from "@tsed/core";
import axios from "axios";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { Errors } from "io-ts";
import { formatValidationErrors } from "io-ts-reporters";
import { Logger } from "tslog";

const logger = new Logger({ name: "ContentGatewayClient" });

/**
 * The {@link ContentGatewayClient} is the client-side component of the *Content Gateway*.
 * Use it to {@link ContentGatewayClient#register | register} your schema types and to
 * {@link ContentGatewayClient#save | send } the corresponding data to the gateway.
 */
export type ContentGatewayClient = {
    /**
     * Registers a new unique Type with the gateway.
     * Use `@tsed/schema` decorators when creating the Type.
     * Example:
     *
     * ```ts
     * import { Required } from "@tsed/schema";
     *
     * @AdditionalProperties(false)
     * class User {
     *     @Required(true)
     *     id: number;
     *     @Required(true)
     *     name: string;
     *     @Required(true)
     *     email: string;
     * }
     * ```
     */
    // ⚠️ note that these should return TE.TaskEithers but it is easier this way for non-fp users.
    register: <T>(
        info: SchemaInfo,
        type: Type<T>
    ) => Promise<E.Either<Error, void>>;
    /**
     * Saves the [[data]] to the Content Gateway using the scema's metadata to
     * identify it. This will return an error if the type of [[data]] is not
     *  {@link ContentGatewayClient#register | register}ed.
     */
    save: <T>(info: SchemaInfo, data: T) => Promise<E.Either<Error, void>>;
    /**
     * Same as {@link ContentGatewayClient#save} but sends a batch
     */
    saveBatch: <T>(
        info: SchemaInfo,
        data: Array<T>
    ) => Promise<E.Either<Error, void>>;
};

/**
 * This abstraction hides the implementation details of how data is sent over the wire.
 */
export type OutboundDataAdapter = {
    register: (schema: SchemaJson) => TE.TaskEither<Error, void>;
    send: (payload: PayloadJson) => TE.TaskEither<Error, void>;
    sendBatch: (payload: BatchPayloadJson) => TE.TaskEither<Error, void>;
};

export type OutboundDataAdapterStub = {
    schemas: Array<SchemaJson>;
    payloads: Array<PayloadJson | BatchPayloadJson>;
} & OutboundDataAdapter;

export type ClientDependencies = {
    adapter: OutboundDataAdapter;
};

// TODO: extract result here
export const createRESTAdapter = (url: string): OutboundDataAdapter => {
    return {
        register: (schema: SchemaJson) => {
            return TE.tryCatch(
                () => axios.post(`${url}/api/rest/register`, schema),
                (err) => new Error(`Error registering schema: ${err}`)
            );
        },
        send: (payload: PayloadJson) => {
            return TE.tryCatch(
                () => axios.post(`${url}/api/rest/receive`, payload),
                (err) => new Error(`Error sending payload: ${err}`)
            );
        },
        sendBatch: (payload: BatchPayloadJson) => {
            return TE.tryCatch(
                () => axios.post(`${url}/api/rest/receive-batch`, payload),
                (err) => new Error(`Error sending payload: ${err}`)
            );
        },
    };
};

export type ContentGatewayClientStub = {
    adapter: OutboundDataAdapterStub;
} & ContentGatewayClient;

/**
 * Creates a stub {@link OutboundDataAdapter} with the corresponding storage
 * objects that can be used for testing.
 */
export const createOutboundAdapterStub = (): OutboundDataAdapterStub => {
    const schemas = [] as Array<SchemaJson>;
    const payloads = [] as Array<PayloadJson | BatchPayloadJson>;
    return {
        schemas,
        payloads,
        register: (schema) => {
            logger.info(`Registering schema:`, schema);
            schemas.push(schema);
            logger.debug(`Registered schemas:`, schemas);
            return TE.right(undefined);
        },
        send: (payload) => {
            logger.info(`Sending payload:`, payload);
            payloads.push(payload);
            logger.debug(`Sent payloads:`, payloads);
            return TE.right(undefined);
        },
        sendBatch: (payload) => {
            logger.info(`Sending payload:`, payload);
            payloads.push(payload);
            logger.debug(`Sent payloads:`, payloads);
            return TE.right(undefined);
        },
    };
};

/**
 * Creates a new {@link ContentGatewayClientStub} instance that uses
 * in-memory storage and default serialization. Can be used for
 * testing purposes.
 */
export const createClientStub: () => ContentGatewayClientStub = () => {
    const adapter = createOutboundAdapterStub();
    const client = createClient({ adapter });
    return {
        adapter,
        ...client,
    };
};

/**
 * This object is instantiated in the client.
 */
export const createClient = ({
    adapter,
}: ClientDependencies): ContentGatewayClient => {
    const schemas = new Map<string, Schema>();
    const logger = new Logger({ name: "ContentGatewayClient" });
    return {
        register: <T>(
            info: SchemaInfo,
            type: Type<T>
        ): Promise<E.Either<Error, void>> => {
            return pipe(
                createSchemaFromType(info, type),
                TE.fromEither,
                TE.mapLeft(
                    (err: Errors) =>
                        new Error(formatValidationErrors(err).join("\n"))
                ),
                TE.chainFirstIOK(
                    (schema) => () =>
                        schemas.set(schemaInfoToString(info), schema)
                ),
                TE.chain((schema) => {
                    logger.info(`Registering schema`, schema.info);
                    return adapter.register({
                        info: info,
                        jsonSchema: schema.jsonSchema,
                    });
                })
            )();
        },
        save: <T>(
            info: SchemaInfo,
            data: T
        ): Promise<E.Either<Error, void>> => {
            const mapKey = schemaInfoToString(info);
            const maybeSchema = O.fromNullable(schemas.get(mapKey));
            return pipe(
                maybeSchema,
                TE.fromOption(
                    () =>
                        new Error(`The given type ${mapKey} is not registered`)
                ),
                TE.chainW((schema) =>
                    TE.fromEither(
                        schema.validate(data as Record<string, unknown>)
                    )
                ),
                mapError(),
                TE.chain((dataRecord) =>
                    adapter.send({
                        info: info,
                        data: dataRecord,
                    })
                )
            )();
        },
        saveBatch: <T>(
            info: SchemaInfo,
            data: Array<T>
        ): Promise<E.Either<Error, void>> => {
            const mapKey = schemaInfoToString(info);
            const maybeSchema = O.fromNullable(schemas.get(mapKey));
            return pipe(
                maybeSchema,
                TE.fromOption(
                    () =>
                        new Error(`The given type ${mapKey} is not registered`)
                ),
                TE.chainW((schema) => {
                    const result = pipe(
                        data,
                        E.traverseArray((record) =>
                            schema.validate(record as Record<string, unknown>)
                        )
                    );
                    return TE.fromEither(result);
                }),
                mapError(),
                TE.chain((dataArray) =>
                    adapter.sendBatch({
                        info: info,
                        data: dataArray as Array<Record<string, unknown>>,
                    })
                )
            )();
        },
    };
};

const mapError = () =>
    TE.mapLeft((err: Error | ValidationError[]) => {
        let result: string;
        if (isArray(err)) {
            result = err.map((e) => `field ${e.field} ${e.message}`).join(",");
        } else {
            result = err.message;
        }
        return new Error(result);
    });
