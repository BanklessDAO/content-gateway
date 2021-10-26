/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    PayloadDTO,
    payloadToString,
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
import * as R from "fp-ts/Reader";
import * as TE from "fp-ts/TaskEither";
import { failure } from "io-ts/lib/PathReporter";

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
    register: (schema: string) => TE.TaskEither<Error, void>;
    send: (payload: string) => TE.TaskEither<Error, void>;
};

export type ClientDependencies = {
    serializer: JSONSerializer;
    adapter: OutboundDataAdapter;
};

export const createRESTAdapter = (): OutboundDataAdapter => {
    throw new Error("Not implemented");
};

type StubOutboundAdapterObjects = {
    schemas: Array<string>;
    payloads: Array<string>;
    adapter: OutboundDataAdapter;
};

type StubClientObjects = {
    adapter: StubOutboundAdapterObjects;
    client: ContentGatewayClient;
};

/**
 * Creates a stub {@link OutboundDataAdapter} with the corresponding storage
 * objects that can be used for testing.
 */
const createStubOutboundAdapter = (): StubOutboundAdapterObjects => {
    const schemas = [] as Array<string>;
    const payloads = [] as Array<string>;
    const adapter: OutboundDataAdapter = {
        register: (schema) => {
            schemas.push(schema);
            return TE.right(undefined);
        },
        send: (payload) => {
            payloads.push(payload);
            return TE.right(undefined);
        },
    };
    return {
        schemas,
        payloads,
        adapter,
    };
};

/**
 * Creates a new {@link ContentGatewayClient} instance that uses
 * in-memory storage and default serialization. Can be used for
 * testing purposes.
 */
export const createStubClient: () => StubClientObjects = () => {
    const serializer = createDefaultJSONSerializer();
    const adapter = createStubOutboundAdapter();
    const client = createClient({ serializer, adapter: adapter.adapter });
    return {
        adapter,
        client,
    };
};

/**
 * This object is instantiated in the client.
 */
export const createClient: R.Reader<ClientDependencies, ContentGatewayClient> =
    ({ serializer, adapter }) => {
        const schemas = new Map<string, Schema>();
        const schemaInfoSerializer = schemaInfoToString(serializer);
        const payloadSerializer = payloadToString(serializer);
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
                            serializer.serialize(
                                SchemaDTO.toJSON(
                                    new SchemaDTO(info, schema.toJSONString())
                                )
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
                            new Error(
                                `The given type ${mapKey} is not registered`
                            )
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
                            payloadSerializer(
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
