import { User } from "@shared/util-auth";
import * as t from "io-ts";
import { SafeApiKey } from ".";

export const ContentGatewayUserCodec = t.strict({
    id: t.string,
    name: t.string,
    roles: t.array(t.string),
    apiKeys: t.array(
        t.strict({
            id: t.string,
            hash: t.string,
        })
    ),
});

export interface ContentGatewayUser extends User<string> {
    apiKeys: SafeApiKey[];
}
