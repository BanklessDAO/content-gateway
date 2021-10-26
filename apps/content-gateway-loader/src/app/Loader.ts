import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import * as E from "fp-ts/Either";

export type Loader = {
    load: (client: ContentGatewayClient) => Promise<E.Either<Error, void>>;
};
