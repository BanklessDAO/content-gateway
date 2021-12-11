import { ContentGatewayClientV1 } from "@banklessdao/sdk";
import { ProgramError } from "@shared/util-data";
import { SchemaInfo } from "@shared/util-schema";
import * as TE from "fp-ts/TaskEither";
import { Job, JobDescriptor, JobRepository, JobScheduler } from ".";

/**
 * Contains the necessary information for initializing.
 */
export type InitContext = {
    client: ContentGatewayClientV1;
    jobScheduler: JobScheduler;
    jobRepository: JobRepository;
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
    client: ContentGatewayClientV1;
    jobScheduler: JobScheduler;
    loadingResult: LoadingResult<T>;
};

export interface DataLoader<T> {
    info: SchemaInfo;
    /**
     * Initializes this loader. This will be called once each time
     * the application starts.
     */
    initialize: (deps: InitContext) => TE.TaskEither<ProgramError, void>;
    /**
     * Loads data from the data source asynchronously.
     */
    load: (deps: LoadContext) => TE.TaskEither<ProgramError, LoadingResult<T>>;
    /**
     * Sends the data to the Content Gateway API asynchronously.
     */
    save: (
        deps: SaveContext<T>
    ) => TE.TaskEither<ProgramError, JobDescriptor | undefined>;
}
