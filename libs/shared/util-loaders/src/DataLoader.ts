import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { SchemaInfo } from "@shared/util-schema";
import * as TE from "fp-ts/TaskEither";
import { Job, JobDescriptor, JobScheduler } from ".";

/**
 * Contains the necessary information for initializing.
 */
export type InitContext = {
    client: ContentGatewayClient;
    jobScheduler: JobScheduler;
};

export type LoadContext = {
    cursor?: string;
    limit: number;
};

export type LoadingResult<T> = {
    data: T[];
    cursor: string;
};

export type SaveContext<T> = {
    currentJob: Job;
    client: ContentGatewayClient;
    jobScheduler: JobScheduler;
    loadingResult: LoadingResult<T>;
};

export type DataLoader<T> = {
    info: SchemaInfo;
    /**
     * Initializes this loader. This will be called once each time
     * the application starts.
     */
    initialize: (deps: InitContext) => TE.TaskEither<Error, void>;
    /**
     * Loads data from the data source asynchronously.
     */
    load: (deps: LoadContext) => TE.TaskEither<Error, LoadingResult<T>>;
    /**
     * Sends the data to the Content Gateway API asynchronously.
     */
    save: (
        deps: SaveContext<T>
    ) => TE.TaskEither<Error, JobDescriptor | undefined>;
};
