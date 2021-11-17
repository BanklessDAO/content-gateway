import { createLogger } from "@shared/util-fp";
import { SchemaJson } from "@shared/util-schema";
import axios from "axios";
import * as TE from "fp-ts/TaskEither";
import { JsonBatchPayload, JsonPayload } from "./codecs";

/**
 * This abstraction hides the implementation details of how data is sent over the wire.
 */
export type OutboundDataAdapter = {
    register: (schema: SchemaJson) => TE.TaskEither<Error, void>;
    send: (payload: JsonPayload) => TE.TaskEither<Error, void>;
    sendBatch: (payload: JsonBatchPayload) => TE.TaskEither<Error, void>;
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
            return TE.right(undefined);
        },
        send: (payload) => {
            payloads.push(payload);
            return TE.right(undefined);
        },
        sendBatch: (payload) => {
            payloads.push(payload);
            return TE.right(undefined);
        },
    };
};

// TODO: extract result here
export const createRESTAdapter = (url: string): OutboundDataAdapter => {
    const logger = createLogger("RESTOutboundDataAdapter");
    return {
        register: (schema: SchemaJson) => {
            return TE.tryCatch(
                () => axios.post(`${url}/api/rest/register`, schema),
                (err) => new Error(`Error registering schema: ${err}`)
            );
        },
        send: (payload: JsonPayload) => {
            return TE.tryCatch(
                () => axios.post(`${url}/api/rest/receive`, payload),
                (err) => new Error(`Error sending payload: ${err}`)
            );
        },
        sendBatch: (payload: JsonBatchPayload) => {
            return TE.tryCatch(
                async () => {
                    const result = await axios.post(
                        `${url}/api/rest/receive-batch`,
                        payload
                    );

                    logger.info(
                        `status: ${result.status}, text: ${result.statusText}`
                    );
                },
                (err: unknown) => {
                    // TODO: code paths
                    if (axios.isAxiosError(err)) {
                        return new Error(`Error sending payload.`);
                    } else {
                        return new Error(`Error sending payload.`);
                    }
                }
            );
        },
    };
};
