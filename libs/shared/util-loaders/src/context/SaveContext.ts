import { ContentGatewayClient } from "@banklessdao/content-gateway-sdk";
import { Jobs } from ".";
import { Job, LoadingResult } from "..";

/**
 * Contains all the objects that can be necessary for
 * saving data.
 */
export type SaveContext<T> = {
    /**
     * The current Job that is being executed.
     */
    currentJob: Job;
    /**
     * Can be used to interact with the Content Gateway API.
     */
    client: ContentGatewayClient;
    /**
     * You can use this object to store and retrieve Jobs, and to
     * register new loaders.
     */
    jobs: Jobs;
    /**
     * The result of the loading operation.
     */
    loadingResult: LoadingResult<T>;
};
