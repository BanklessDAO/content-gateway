import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { schemaInfoCodec } from ".";

export const jsonPayloadCodec = t.strict({
    info: schemaInfoCodec,
    data: withMessage(
        t.record(t.string, t.unknown),
        () => "Data is not a valid json object"
    ),
});

export type JsonPayload = t.TypeOf<typeof jsonPayloadCodec>;

export const jsonBatchPayloadCodec = t.strict({
    info: schemaInfoCodec,
    data: withMessage(
        t.array(t.record(t.string, t.unknown)),
        () => "Data is not a valid json array"
    ),
});

export type JsonBatchPayload = t.TypeOf<typeof jsonBatchPayloadCodec>;
