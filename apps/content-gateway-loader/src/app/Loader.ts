import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import * as TE from "fp-ts/TaskEither";
import { Job } from "./Job";
import { JobScheduler } from "./JobScheduler";

/**
 * Contains the necessary information for loading.
 */
export type LoaderContext<T, D> = {
    client: ContentGatewayClient;
    currentJob: Job<D>;
    jobScheduler: JobScheduler;
    /**
     * The cursor is an arbitrary value (usually a number or a string) that represents
     * he point where we "left off" since the last batch was loaded.
     * More info [here](http://mysql.rjweb.org/doc.php/pagination).
     */
    cursor: T;
    /**
     * The nubmer of items to load.
     */
    limit: number;
};

/**
 * A loader encapsulates the *pull* logic for a specific data source
 * (eg: it loads data periodically from a remote source).
 */
export type Loader<T, D> = {
    /**
     * Loads data from the data source asynchronously.
     */
    load: (deps: LoaderContext<T, D>) => TE.TaskEither<Error, void>;
    /**
     * Serializes your custom data structure to be stored
     */
    serialize(data: D): string;
    /**
     * Deserializes the custom data
     */
    deserialize(data: string): D;
};

export const createSimpleLoader = <T>(
    load: (deps: LoaderContext<T, void>) => TE.TaskEither<Error, void>
): Loader<T, void> => {
    return {
        load: load,
        serialize: () => undefined,
        deserialize: () => undefined,
    };
};
