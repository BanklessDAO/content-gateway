import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { SchemaInfo } from "@shared/util-schema";
import * as TE from "fp-ts/TaskEither";
import { Job, JobDescriptor, JobScheduler } from ".";

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

export type SaveContext<T> = {
    currentJob: Job;
    client: ContentGatewayClient;
    jobScheduler: JobScheduler;
    data: T[];
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
    load: (deps: LoadContext) => TE.TaskEither<Error, T[]>;
    /**
     * Sends the data to the Content Gateway API asynchronously.
     */
    save: (
        deps: SaveContext<T>
    ) => TE.TaskEither<Error, JobDescriptor | undefined>;
};
