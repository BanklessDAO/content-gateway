import { DataTransferError } from "@banklessdao/util-data";
import {
    ClassType,
    createSchemaFromClass,
    Payload,
    Schema,
    SchemaInfo,
    schemaInfoToString,
    SchemaValidationError
} from "@banklessdao/util-schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import {
    createHTTPAdapterV1,
    OutboundDataAdapterStub,
    SchemaNotFoundError
} from ".";
import {
    createOutboundAdapterStub,
    OutboundDataAdapter
} from "./OutboundDataAdapter";

export type RegistrationParams<T> = {
    info: SchemaInfo;
    type: ClassType<T>;
};

export type SaveParams<T> = {
    payload: Payload<T>;
};

export type SaveBatchParams<T> = {
    payload: Payload<Array<T>>;
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
        saveParams: SaveParams<T>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
    /**
     * Same as {@link ContentGatewayClientV1#save} but sends multiple entries at once.
     */
    saveBatch: <T>(
        saveBatchParams: SaveBatchParams<T>
    ) => TE.TaskEither<ClientError, Record<string, unknown>>;
};

/**
 * Creates a new instance of the Content Gateway Client (V1) that will use
 * the _production_ version of the Content Gateway API that's deployed
 * by _BanklessDAO_ by default.
 */
export const createDefaultClientV1 = ({
    apiKey,
    apiURL = "https://prod-content-gateway-api.herokuapp.com",
}: {
    apiKey: string;
    apiURL: string;
}) => {
    return createContentGatewayClientV1({
        apiKey: apiKey,
        adapter: createHTTPAdapterV1(apiURL),
    });
};

/**
 * Creates a new instance of the Content Gateway Client (V1).
 * @param adapter The adapter to use for sending data to the Content Gateway API. If you're
 * unsure what to pass, use {@link createDefaultClientV1} instead.
 * 📙 **NOTE** that for now you can pass __any__ `apiKey`. Later this will be a required parameter later.
 */
export const createContentGatewayClientV1 = ({
    apiKey,
    adapter,
}: {
    /**
     * Your API key to use when sending requests to the Content Gateway API.
     */
    apiKey: string;
    /**
     * The adapter to use for sending data to the Content Gateway API.
     */
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
            saveParams: SaveParams<T>
        ): TE.TaskEither<ClientError, Record<string, unknown>> => {
            const { payload } = saveParams;
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
            saveBatchParams: SaveBatchParams<T>
        ): TE.TaskEither<ClientError, Record<string, unknown>> => {
            const { payload } = saveBatchParams;
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
    const apiKey = "key";
    const adapter = createOutboundAdapterStub();
    const client = createContentGatewayClientV1({ apiKey, adapter });
    return {
        adapter,
        ...client,
    };
};
