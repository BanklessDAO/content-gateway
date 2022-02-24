import { ContentGatewayClient } from "@banklessdao/content-gateway-sdk";
import { Jobs } from "./Jobs";

/**
 * Contains the necessary information for initializing a loader.
 */
export type InitContext = {
    /**
     * Can be used to interact with the Content Gateway API.
     */
    client: ContentGatewayClient;
    /**
     * You can use this object to store and retrieve Jobs, and to
     * register new loaders.
     */
    jobs: Jobs;
};
