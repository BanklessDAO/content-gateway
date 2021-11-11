import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
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
export type SaveContext = {
    client: ContentGatewayClient;
    currentJob: Job;
    jobScheduler: JobScheduler;
};

export enum OperatorType {
    EQUALS,
    CONTAINS,
    LESS_THAN_OR_EQUAL,
    GREATER_THAN_OR_EQUAL,
}

export type Operator = {
    type: OperatorType;
    field: string;
    value: unknown;
};

export type LoadContext = {
    cursor?: bigint;
    limit: number;
    operators: Operator[];
};

export type DataLoader = {
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
    save: (
        deps: SaveContext
    ) => TE.TaskEither<Error, JobDescriptor | undefined>;
};
