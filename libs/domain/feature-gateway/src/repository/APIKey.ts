import * as t from "io-ts";
import { withMessage } from "io-ts-types";

export const APIKeyCodec = t.strict({
    id: withMessage(t.string, () => "id must be a string"),
    secret: withMessage(t.string, () => "secret must be a string"),
});

/**
 * This type represents the API key id/secret pair.
 */
// TODO: find a way to clean the secret from memory after it is returned
export type APIKey = t.TypeOf<typeof APIKeyCodec>;
