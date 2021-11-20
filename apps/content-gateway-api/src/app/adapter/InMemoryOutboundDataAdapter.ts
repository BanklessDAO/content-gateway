import { OutboundDataAdapter } from "@banklessdao/content-gateway-client";
import { ContentGateway } from "@domain/feature-gateway";
import { createSchemaFromObject } from "@shared/util-schema";
import { jsonBatchPayloadCodec, jsonPayloadCodec } from "@shared/util-dto";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { Errors } from "io-ts";
import { formatValidationErrors } from "io-ts-reporters";
import { failure } from "io-ts/lib/PathReporter";

type Deps = {
    contentGateway: ContentGateway;
};

/**
 * This data adapter will send the payloads to an in-memory {@link ContentGateway} instance
 * instead of using an inter-process communication method (like REST).
 */
export const createInMemoryOutboundDataAdapter = ({
    contentGateway,
}: Deps): OutboundDataAdapter => {
    return {
        register: (schema): TE.TaskEither<Error, void> => {
            return pipe(
                createSchemaFromObject(schema),
                TE.fromEither,
                TE.mapLeft((err: Errors) => new Error(failure(err).join("\n"))),
                TE.chainW(contentGateway.register),
                TE.map(() => undefined)
            );
        },
        send: (payload): TE.TaskEither<Error, void> => {
            return pipe(
                jsonPayloadCodec.decode(payload),
                E.mapLeft(
                    (err: Errors) =>
                        new Error(formatValidationErrors(err).join())
                ),
                TE.fromEither,
                TE.chain(contentGateway.receive),
                TE.chain(() => TE.of(undefined))
            );
        },
        sendBatch: (payload): TE.TaskEither<Error, void> => {
            return pipe(
                jsonBatchPayloadCodec.decode(payload),
                E.mapLeft(
                    (err: Errors) =>
                        new Error(formatValidationErrors(err).join())
                ),
                TE.fromEither,
                TE.chain(contentGateway.receiveBatch),
                TE.chain(() => TE.of(undefined))
            );
        },
    };
};
