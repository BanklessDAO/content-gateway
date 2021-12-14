import { DataTransferError } from "@shared/util-data";
import {
    createSchemaFromClass,
    Payload,
    Schema,
    SchemaInfo,
    schemaInfoToString,
    SchemaValidationError,
    ClassType
} from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { OutboundDataAdapterStub, SchemaNotFoundError } from ".";
import {
    createOutboundAdapterStub,
    OutboundDataAdapter,
} from "./OutboundDataAdapter";

export type RegistrationParams<T> = {
    info: SchemaInfo;
    type: ClassType<T>;
};

type ClientError =
    | SchemaValidationError
    | SchemaNotFoundError
    | DataTransferError;

/**
 * Client component for the Content Gateway API. It provides functionality for
 * - registering schemas with the Content Gateway API
 * - sending data to the Content Gateway API
 *
 */
export type ContentGatewayClientV1 = {
    /**
     * Registers a new unique Type with the gateway.
     * Use `@tsed/schema` decorators when creating the Type.
     * Example:
     *
     * TODO! fix example imports
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
     * Tries to save the supplied [[payload]] to the Content Gateway API.
     * The schema of the payload must be {@link ContentGatewayClientV1#register | register}ed
     * with the Content Gateway API first.
     */
    save: <T>(
        payload: Payload<T>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
    /**
     * Same as {@link ContentGatewayClientV1#save} but sends multiple entries at once.
     */
    saveBatch: <T>(
        payload: Payload<Array<T>>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
};

/**
 * Creates a new instance of the Content Gateway Client (V1).
 * @param adapter The adapter to use for sending data to the Content Gateway API. If you're
 * unsure what to pass, use {@link createHTTPAdapterV1} with the appropriate gateway API
 * url.
 */
export const createContentGatewayClientV1 = ({
    adapter,
}: {
    adapter: OutboundDataAdapter;
}): ContentGatewayClientV1 => {
    const schemas = new Map<string, Schema>();
    return {
        register: <T>({
            info,
            type,
        }: RegistrationParams<T>): TE.TaskEither<
            ClientError,
            Record<string, unknown>
        > => {
            return pipe(
                createSchemaFromClass(type),
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
        save: <T>(
            payload: Payload<T>
        ): TE.TaskEither<ClientError, Record<string, unknown>> => {
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

/**
 * Stub implementation for the Content Gateway Client (V1) that can be used for testing.
 */
export type ContentGatewayClientStub = {
    adapter: OutboundDataAdapterStub;
} & ContentGatewayClientV1;

/**
 * Creates a new {@link ContentGatewayClientStub} instance that uses
 * in-memory storage. Can be used for testing purposes.
 */
export const createClientStub: () => ContentGatewayClientStub = () => {
    const adapter = createOutboundAdapterStub();
    const client = createContentGatewayClientV1({ adapter });
    return {
        adapter,
        ...client,
    };
};
