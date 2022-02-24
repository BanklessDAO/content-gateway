import {
    DataTransferError,
    del,
    JsonBatchPayload,
    post
} from "@banklessdao/util-data";
import { SchemaInfo, SchemaJson } from "@banklessdao/util-schema";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";

/**
 * This abstraction hides the implementation details of how data is sent over the wire.
 * It is used by the SDK to send data to a Content Gateway API server.
 * In 99% of cases what you'll need is the HTTP adapter which can be created by
 * calling the {@link createHTTPAdapterV1} function.
 */
export type OutboundDataAdapter = {
    register: (
        schema: SchemaJson
    ) => TE.TaskEither<DataTransferError, Record<string, unknown>>;
    remove: (
        info: SchemaInfo
    ) => TE.TaskEither<DataTransferError, Record<string, unknown>>;
    send: (
        payload: JsonBatchPayload
    ) => TE.TaskEither<DataTransferError, Record<string, unknown>>;
};

type Params = {
    apiUrl: string;
    apiKey: string;
};

export const createHTTPAdapterV1 = ({
    apiUrl,
    apiKey,
}: Params): OutboundDataAdapter => {
    return {
        register: (schema: SchemaJson) => {
            return post({
                url: `${apiUrl}/api/v1/rest/schema/`,
                input: schema,
                codec: t.UnknownRecord,
                config: {
                    headers: {
                        "X-Api-Key": apiKey,
                    },
                },
            });
        },
        remove: (info: SchemaInfo) => {
            return del({
                url: `${apiUrl}/api/v1/rest/schema/`,
                input: info,
                codec: t.UnknownRecord,
                config: {
                    headers: {
                        "X-Api-Key": apiKey,
                    },
                },
            });
        },
        send: (payload: JsonBatchPayload) => {
            return post({
                url: `${apiUrl}/api/v1/rest/data/receive`,
                input: payload,
                codec: t.UnknownRecord,
                config: {
                    headers: {
                        "X-Api-Key": apiKey,
                    },
                },
            });
        },
    };
};

export type OutboundDataAdapterStub = {
    schemas: Array<SchemaJson>;
    payloads: Array<JsonBatchPayload>;
} & OutboundDataAdapter;

/**
 * Creates a stub {@link OutboundDataAdapter} with the corresponding storage
 * objects that can be used for testing.
 */
export const createOutboundAdapterStub = (): OutboundDataAdapterStub => {
    const schemas = [] as Array<SchemaJson>;
    const payloads = [] as Array<JsonBatchPayload>;
    return {
        schemas,
        payloads,
        register: (schema) => {
            schemas.push(schema);
            return TE.right({});
        },
        remove: () => {
            return TE.right({});
        },
        send: (payload) => {
            payloads.push(payload);
            return TE.right({});
        },
    };
};
