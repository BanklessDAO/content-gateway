import { DataTransferError } from "@banklessdao/util-data";
import {
    ClassType,
    createSchemaFromClass,
    Schema,
    SchemaInfo,
    schemaInfoToString,
    SchemaValidationError
} from "@banklessdao/util-schema";
import { SchemaNotFoundError } from "@domain/feature-gateway";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { createHTTPAdapterV1, OutboundDataAdapterStub } from ".";
import {
    createOutboundAdapterStub,
    OutboundDataAdapter
} from "./OutboundDataAdapter";

export type RegistrationParams<T> = {
    info: SchemaInfo;
    type: ClassType<T>;
};

export type SaveDataParams<T> = {
    info: SchemaInfo;
    data: Array<T>;
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
export type ContentGatewayClient = {
    /**
     * Registers a new unique Type with the gateway.
     */
    register: <T>(
        params: RegistrationParams<T>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
    /**
     * Tries to save the supplied [[payload]] to the Content Gateway API.
     * The schema of the payload must be {@link ContentGatewayClient#register | register}ed
     * with the Content Gateway API first.
     */
    save: <T>(
        payload: SaveDataParams<T>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
};

/**
 * Creates a new instance of the Content Gateway Client (V1) that will use
 * the _production_ version of the Content Gateway API that's deployed
 * by _BanklessDAO_ by default.
 */
// TODO: Remove this and only use env vars
export const createDefaultClient = ({
    apiKeySecret,
    apiURL = "https://prod-content-gateway-api.herokuapp.com",
}: {
    apiKeySecret: string;
    apiURL: string;
}) => {
    return createContentGatewayClient({
        adapter: createHTTPAdapterV1({ apiUrl: apiURL, apiKey: apiKeySecret }),
    });
};

type ContentGatewayClientParams = {
    /**
     * The adapter to use for sending data to the Content Gateway API.
     */
    adapter: OutboundDataAdapter;
};

/**
 * Creates a new instance of the Content Gateway Client.
 * @param adapter The adapter to use for sending data to the Content Gateway API. If you're
 * unsure what to pass, use {@link createDefaultClient} instead.
 * 📙 **NOTE** that for now you can pass __any__ `apiKey`. Later this will be a required parameter later.
 */
export const createContentGatewayClient = ({
    adapter,
}: ContentGatewayClientParams): ContentGatewayClient => {
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
            payload: SaveDataParams<T>
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
                    adapter.send({
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
} & ContentGatewayClient;

/**
 * Creates a new {@link ContentGatewayClientStub} instance that uses
 * in-memory storage. Can be used for testing purposes.
 */
export const createClientStub: () => ContentGatewayClientStub = () => {
    const adapter = createOutboundAdapterStub();
    const client = createContentGatewayClient({ adapter });
    return {
        adapter,
        ...client,
    };
};
