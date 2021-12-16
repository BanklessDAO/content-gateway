import { ContentGatewayClientV1 } from "@banklessdao/content-gateway-sdk";
import { Jobs } from "./Jobs";

/**
 * Contains the necessary information for initializing a loader.
 */
export type InitContext = {
    /**
     * Can be used to interact with the Content Gateway API.
     */
    client: ContentGatewayClientV1;
    /**
     * You can use this object to store and retrieve Jobs, and to
     * register new loaders.
     */
    jobs: Jobs;
};
