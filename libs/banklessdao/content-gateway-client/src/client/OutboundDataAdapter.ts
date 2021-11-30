import {
    DataTransferError,
    JsonBatchPayload,
    JsonPayload,
    post,
} from "@shared/util-dto";
import { SchemaInfo, SchemaJson } from "@shared/util-schema";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";

/**
 * This abstraction hides the implementation details of how data is sent over the wire.
 */
export type OutboundDataAdapter = {
    register: (
        schema: SchemaJson
    ) => TE.TaskEither<DataTransferError, Record<string, unknown>>;
    remove: (
        info: SchemaInfo
    ) => TE.TaskEither<DataTransferError, Record<string, unknown>>;
    send: (
        payload: JsonPayload
    ) => TE.TaskEither<DataTransferError, Record<string, unknown>>;
    sendBatch: (
        payload: JsonBatchPayload
    ) => TE.TaskEither<DataTransferError, Record<string, unknown>>;
};

export const createRESTAdapter = (url: string): OutboundDataAdapter => {
    return {
        register: (schema: SchemaJson) => {
            return post({
                url: `${url}/api/rest/schema/register`,
                input: schema,
                codec: t.UnknownRecord,
            });
        },
        remove: (info: SchemaInfo) => {
            return post({
                url: `${url}/api/rest/schema/remove`,
                input: info,
                codec: t.UnknownRecord,
            });
        },
        send: (payload: JsonPayload) => {
            return post({
                url: `${url}/api/rest/schema/receive`,
                input: payload,
                codec: t.UnknownRecord,
            });
        },
        sendBatch: (payload: JsonBatchPayload) => {
            return post({
                url: `${url}/api/rest/schema/receive-batch`,
                input: payload,
                codec: t.UnknownRecord,
            });
        },
    };
};

export type OutboundDataAdapterStub = {
    schemas: Array<SchemaJson>;
    payloads: Array<JsonPayload | JsonBatchPayload>;
} & OutboundDataAdapter;

/**
 * Creates a stub {@link OutboundDataAdapter} with the corresponding storage
 * objects that can be used for testing.
 */
export const createOutboundAdapterStub = (): OutboundDataAdapterStub => {
    const schemas = [] as Array<SchemaJson>;
    const payloads = [] as Array<JsonPayload | JsonBatchPayload>;
    return {
        schemas,
        payloads,
        register: (schema) => {
            schemas.push(schema);
            return TE.right({});
        },
        remove: (info) => {
            return TE.right({});
        },
        send: (payload) => {
            payloads.push(payload);
            return TE.right({});
        },
        sendBatch: (payload) => {
            payloads.push(payload);
            return TE.right({});
        },
    };
};
