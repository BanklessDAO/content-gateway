import { DataTransferError } from "@shared/util-dto";
import {
    createSchemaFromType,
    Payload,
    Schema,
    SchemaInfo,
    schemaInfoToString,
    SchemaValidationError
} from "@shared/util-schema";
import { Type } from "@tsed/core";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { OutboundDataAdapterStub, SchemaNotFoundError } from ".";
import {
    createOutboundAdapterStub,
    OutboundDataAdapter
} from "./OutboundDataAdapter";
export type Deps = {
    adapter: OutboundDataAdapter;
};

export type RegistrationParams<T> = {
    info: SchemaInfo;
    type: Type<T>;
};

type ClientError =
    | SchemaValidationError
    | SchemaNotFoundError
    | DataTransferError;

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
    register: <T>(
        params: RegistrationParams<T>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
    /**
     * Saves the [[data]] to the Content Gateway using the schema's metadata to
     * identify it. This will return an error if the type of [[data]] is not
     *  {@link ContentGatewayClient#register | register}ed.
     */
    save: <T>(payload: Payload<T>) => TE.TaskEither<ClientError, Record<string, unknown>>;
    /**
     * Same as {@link ContentGatewayClient#save} but sends a batch
     */
    saveBatch: <T>(
        payload: Payload<Array<T>>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
};



export const createContentGatewayClient = ({
    adapter,
}: Deps): ContentGatewayClient => {
    const schemas = new Map<string, Schema>();
    return {
        register: <T>({
            info,
            type,
        }: RegistrationParams<T>): TE.TaskEither<ClientError, Record<string, unknown>> => {
            return pipe(
                createSchemaFromType(info, type),
                TE.fromEither,
                TE.chainFirstIOK(
                    (schema) => () =>
                        schemas.set(schemaInfoToString(info), schema)
                ),
                TE.chainW((schema) => {
                    return adapter.register({
                        info: info,
                        jsonSchema: schema.jsonSchema,
                    });
                })
            );
        },
        save: <T>(payload: Payload<T>): TE.TaskEither<ClientError, Record<string, unknown>> => {
            const { info, data } = payload;
            const mapKey = schemaInfoToString(info);
            const maybeSchema = O.fromNullable(schemas.get(mapKey));
            return pipe(
                maybeSchema,
                TE.fromOption(() => new SchemaNotFoundError(info)),
                TE.chainW((schema) =>
                    TE.fromEither(
                        schema.validate(data as Record<string, unknown>)
                    )
                ),
                TE.chainW((dataRecord) =>
                    adapter.send({
                        info: info,
                        data: dataRecord,
                    })
                )
            );
        },
        saveBatch: <T>(
            payload: Payload<Array<T>>
        ): TE.TaskEither<ClientError, Record<string, unknown>> => {
            const { info, data } = payload;
            const mapKey = schemaInfoToString(info);
            const maybeSchema = O.fromNullable(schemas.get(mapKey));
            return pipe(
                maybeSchema,
                TE.fromOption(() => new SchemaNotFoundError(info)),
                TE.chainW((schema) => {
                    const result = pipe(
                        data,
                        E.traverseArray((record) =>
                            schema.validate(record as Record<string, unknown>)
                        )
                    );
                    return TE.fromEither(result);
                }),
                TE.chainW((dataArray) =>
                    adapter.sendBatch({
                        info: info,
                        data: dataArray as Array<Record<string, unknown>>,
                    })
                )
            );
        },
    };
};

export type ContentGatewayClientStub = {
    adapter: OutboundDataAdapterStub;
} & ContentGatewayClient;

/**
 * Creates a new {@link ContentGatewayClientStub} instance that uses
 * in-memory storage and default serialization. Can be used for
 * testing purposes.
 */
export const createClientStub: () => ContentGatewayClientStub = () => {
    const adapter = createOutboundAdapterStub();
    const client = createContentGatewayClient({ adapter });
    return {
        adapter,
        ...client,
    };
};
