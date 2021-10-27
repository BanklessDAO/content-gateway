import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { Tagged, tagged } from "@shared/util-fp";
import * as TE from "fp-ts/TaskEither";
import { JobDescriptor } from ".";
import { Job } from "./Job";
import { JobScheduler } from "./JobScheduler";

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
export type LoadContext<T> = {
    client: ContentGatewayClient;
    currentJob: Job<T>;
    jobScheduler: JobScheduler;
};

type LoaderBase<T> = {
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
        deps: LoadContext<T>
    ) => TE.TaskEither<Error, JobDescriptor<T> | undefined>;
};

/**
 * A loader encapsulates the *pull* logic for a specific data source
 * (eg: it loads data periodically from a remote source).
 */
export type LoaderWithData<T> = {
    /**
     * Serializes your custom data structure to be stored
     */
    serialize(data: T): string;
    /**
     * Deserializes the custom data
     */
    deserialize(data: string): T;
} & LoaderBase<T> &
    Tagged<"LoaderWithData">;

export type SimpleLoader = LoaderBase<void> & Tagged<"SimpleLoader">;

export type Loader<T> = LoaderWithData<T> | SimpleLoader;

export const createSimpleLoader = (
    base: Omit<SimpleLoader, "__tag">
): SimpleLoader => {
    return {
        ...base,
        ...tagged("SimpleLoader"),
    };
};

export const createLoaderWithData = <T>(
    base: Omit<LoaderWithData<T>, "__tag">
): LoaderWithData<T> => {
    return {
        ...base,
        ...tagged("LoaderWithData"),
    };
};
