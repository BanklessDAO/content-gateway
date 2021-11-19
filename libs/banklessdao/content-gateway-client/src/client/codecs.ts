import { schemaInfoCodec } from "@shared/util-schema";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";

export const jsonPayloadCodec = t.strict({
    info: schemaInfoCodec,
    data: withMessage(
        t.record(t.string, t.unknown),
        () => "Data is not a valid json object"
    ),
});

export type JsonPayload = t.TypeOf<typeof jsonPayloadCodec>;

export const jsonBatchPayloadCodec = withMessage(
    t.strict({
        info: schemaInfoCodec,
        data: t.array(t.record(t.string, t.unknown)),
    }),
    () => "Payload is invalid"
);

export type JsonBatchPayload = t.TypeOf<typeof jsonBatchPayloadCodec>;
