import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { Tagged, tagged } from "@shared/util-fp";
import * as TE from "fp-ts/TaskEither";
import { Job, JobDescriptor, JobScheduler } from ".";

/**
 * Contains the necessary information for initializing.
 */
export type InitContext = {
    client: ContentGatewayClient;
    jobScheduler: JobScheduler;
};

/**
 * Contains the necessary information for loading.
 */
export type LoadContext = {
    client: ContentGatewayClient;
    currentJob: Job;
    jobScheduler: JobScheduler;
};

type LoaderBase = {
    name: string;
    /**
     * Initializes this loader. This will be called once each time
     * the application starts.
     */
    initialize: (deps: InitContext) => TE.TaskEither<Error, void>;
    /**
     * Loads data from the data source asynchronously. This will be
     * called according to the schedule defined by the job.
     * @returns an optional job to be scheduled next.
     */
    load: (
        deps: LoadContext
    ) => TE.TaskEither<Error, JobDescriptor | undefined>;
};

export type SimpleLoader = LoaderBase & Tagged<"SimpleLoader">;

export type Loader = SimpleLoader;

export const createSimpleLoader = (
    base: Omit<SimpleLoader, "__tag">
): SimpleLoader => {
    return {
        ...base,
        ...tagged("SimpleLoader"),
    };
};
