/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    PayloadDTO,
    SchemaDTO,
    SchemaInfoDTO,
    schemaInfoToString,
} from "@shared/util-dto";
import {
    createDefaultJSONSerializer,
    createSchemaFromType,
    JSONSerializer,
    Schema,
    SchemaInfo,
} from "@shared/util-schema";
import { isArray, Type } from "@tsed/core";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import { Reader } from "fp-ts/Reader";
import * as TE from "fp-ts/TaskEither";
import { failure } from "io-ts/lib/PathReporter";
import { Logger } from "tslog";
import axios from "axios";

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
};

/**
 * This abstraction hides the implementation details of how data is sent over the wire.
 */
export type OutboundDataAdapter = {
    register: (schema: Record<string, unknown>) => TE.TaskEither<Error, void>;
    send: (payload: Record<string, unknown>) => TE.TaskEither<Error, void>;
};

export type OutboundDataAdapterStub = {
    schemas: Array<Record<string, unknown>>;
    payloads: Array<Record<string, unknown>>;
} & OutboundDataAdapter;

export type ClientDependencies = {
    serializer: JSONSerializer;
    adapter: OutboundDataAdapter;
};

export const createRESTAdapter = (url: string): OutboundDataAdapter => {
    return {
        register: (schema: Record<string, unknown>) => {
            return TE.tryCatch(
                () => axios.post(`${url}/api/rest/register`, schema),
                (err) => new Error(`Error registering schema: ${err}`)
            );
        },
        send: (payload: Record<string, unknown>) => {
            return TE.tryCatch(
                () => axios.post(`${url}/api/rest/receive`, payload),
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
export const createStubOutboundAdapter = (): OutboundDataAdapterStub => {
    const schemas = [] as Array<Record<string, unknown>>;
    const payloads = [] as Array<Record<string, unknown>>;
    return {
        schemas,
        payloads,
        register: (schema) => {
            logger.info(`Registering schema: ${schema}`);
            schemas.push(schema);
            logger.debug(`Registered schemas: ${schemas}`);
            return TE.right(undefined);
        },
        send: (payload) => {
            logger.info(`Sending payload: ${payload}`);
            payloads.push(payload);
            logger.debug(`Sent payloads: ${payloads}`);
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
    const serializer = createDefaultJSONSerializer();
    const adapter = createStubOutboundAdapter();
    const client = createClient({ serializer, adapter });
    return {
        adapter,
        ...client,
    };
};

/**
 * This object is instantiated in the client.
 */
export const createClient: Reader<ClientDependencies, ContentGatewayClient> = ({
    serializer,
    adapter,
}) => {
    const schemas = new Map<string, Schema>();
    const schemaInfoSerializer = schemaInfoToString(serializer);
    const typeToSchema = createSchemaFromType(serializer);

    return {
        register: <T>(
            info: SchemaInfo,
            type: Type<T>
        ): Promise<E.Either<Error, void>> => {
            return pipe(
                typeToSchema(info, type),
                TE.fromEither,
                TE.mapLeft((err) => new Error(failure(err).join("\n"))),
                TE.chainFirstIOK(
                    (schema) => () =>
                        schemas.set(schemaInfoSerializer(info), schema)
                ),
                TE.chain((schema) =>
                    adapter.register(
                        SchemaDTO.toJSON(
                            new SchemaDTO(info, schema.schemaObject)
                        )
                    )
                )
            )();
        },
        save: <T>(
            info: SchemaInfo,
            data: T
        ): Promise<E.Either<Error, void>> => {
            const mapKey = schemaInfoSerializer(info);
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
                TE.mapLeft((err) => {
                    let result: string;
                    if (isArray(err)) {
                        result = err
                            .map((e) => `field ${e.field} ${e.message}`)
                            .join(",");
                    } else {
                        result = err.message;
                    }
                    return new Error(result);
                }),
                TE.chain((dataRecord) =>
                    adapter.send(
                        PayloadDTO.toJSON(
                            new PayloadDTO(
                                SchemaInfoDTO.fromSchemaInfo(info),
                                dataRecord
                            )
                        )
                    )
                )
            )();
        },
    };
};
