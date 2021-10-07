/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    PayloadDTO,
    payloadToString,
    SchemaDTO,
    SchemaInfoDTO,
    schemaInfoToString,
} from "@shared/util-dto";
import {
    createSchemaFromType,
    JSONSerializer,
    Schema,
    SchemaInfo,
} from "@shared/util-schema";
import { Type } from "@tsed/core";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";

/**
 * The {@link ContentGatewayClient} is the client-side component of the *Content Gateway*.
 * Use it to {@link ContentGatewayClient#register | register} your schema types and to
 * {@link ContentGatewayClient#send | send } the corresponding data to the gateway.
 */
export type ContentGatewayClient = {
    /**
     * Register a new unique Type with the gateway.
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
     *
     *     constructor(id: number, name: string, email: string) {
     *         this.id = id;
     *         this.name = name;
     *         this.email = email;
     *     }
     * }
     * ```
     */
    register: <T>(key: SchemaInfo, type: Type<T>) => E.Either<Error, void>;
    /**
     * Sends the [[data]] to the Content Gateway using the [[key]] as the unique identifier.
     * This will return an error if the type of [[data]] is not
     *  {@link ContentGatewayClient#register | register}ed.
     */
    send: <T>(key: SchemaInfo, data: T) => E.Either<Error, void>;
};

/**
 * This abstraction hides the implementation details of how data is sent over the wire.
 */
export type OutboundDataAdapter = {
    register: (schema: string) => E.Either<Error, void>;
    send: (payload: string) => E.Either<Error, void>;
};

/**
 * Factory function for creating a {@link ContentGatewayClient} instance.
 */
export type ClientFactory = (
    serializer: JSONSerializer,
    adapter: OutboundDataAdapter
) => ContentGatewayClient;

/**
 * This object is instantiated in the client.
 */
export const createClient: ClientFactory = (
    serializer: JSONSerializer,
    adapter: OutboundDataAdapter
) => {
    const schemas = new Map<string, Schema>();
    const toSchema = createSchemaFromType(serializer);
    const schemaInfoSerializer = schemaInfoToString(serializer);
    const payloadSerializer = payloadToString(serializer);

    return {
        register: <T>(
            info: SchemaInfo,
            type: Type<T>
        ): E.Either<Error, void> => {
            return pipe(
                toSchema(info, type),
                E.mapLeft((err) => new Error(String(err))),
                E.chain((schema) =>
                    E.tryCatch(
                        () => {
                            schemas.set(schemaInfoSerializer(info), schema);
                            adapter.register(
                                serializer.serialize(
                                    SchemaDTO.toJSON(
                                        new SchemaDTO(
                                            info,
                                            schema.toJSONString()
                                        )
                                    )
                                )
                            );
                        },
                        (reason) => new Error(String(reason))
                    )
                )
            );
        },
        send: <T>(info: SchemaInfo, data: T): E.Either<Error, void> => {
            const mapKey = schemaInfoSerializer(info);
            const maybeSchema = O.fromNullable(schemas.get(mapKey));
            return pipe(
                maybeSchema,
                E.fromOption(
                    () =>
                        new Error(`The given type ${mapKey} is not registered`)
                ),
                E.chainW((schema) =>
                    schema.validate(data as Record<string, unknown>)
                ),
                E.mapLeft((err) => new Error(String(err))),
                E.chain((dataRecord) =>
                    adapter.send(
                        payloadSerializer(
                            new PayloadDTO(
                                SchemaInfoDTO.fromSchemaInfo(info),
                                dataRecord
                            )
                        )
                    )
                )
            );
        },
    };
};
