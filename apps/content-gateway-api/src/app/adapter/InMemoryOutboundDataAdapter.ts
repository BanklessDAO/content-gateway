import { OutboundDataAdapter } from "@banklessdao/content-gateway-sdk";
import { ContentGateway } from "@domain/feature-gateway";
import {
    DataTransferError,
    jsonBatchPayloadCodec,
    jsonPayloadCodec,
    mapCodecValidationError
} from "@banklessdao/util-data";
import { createSchemaFromObject, SchemaInfo } from "@banklessdao/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

/**
 * This data adapter will send the payloads to an in-memory {@link ContentGateway} instance
 * instead of using an inter-process communication method (like REST).
 */
export const createInMemoryOutboundDataAdapter = ({
    contentGateway,
}: {
    contentGateway: ContentGateway;
}): OutboundDataAdapter => {
    return {
        register: (
            schema
        ): TE.TaskEither<DataTransferError, Record<string, unknown>> => {
            return pipe(
                createSchemaFromObject(schema),
                TE.fromEither,
                TE.chainW(contentGateway.register),
                TE.chain(() => TE.of({}))
            );
        },
        remove: (
            info: SchemaInfo
        ): TE.TaskEither<DataTransferError, Record<string, unknown>> => {
            return pipe(
                contentGateway.remove(info),
                TE.chain(() => TE.of({}))
            );
        },
        send: (
            payload
        ): TE.TaskEither<DataTransferError, Record<string, unknown>> => {
            return pipe(
                jsonPayloadCodec.decode(payload),
                mapCodecValidationError("Validating json payload failed"),
                TE.fromEither,
                TE.chainW(contentGateway.receive),
                TE.chain(() => TE.of({}))
            );
        },
        sendBatch: (
            payload
        ): TE.TaskEither<DataTransferError, Record<string, unknown>> => {
            return pipe(
                jsonBatchPayloadCodec.decode(payload),
                mapCodecValidationError("Validating json batch payload failed"),
                TE.fromEither,
                TE.chainW(contentGateway.receiveBatch),
                TE.chain(() => TE.of({}))
            );
        },
    };
};
