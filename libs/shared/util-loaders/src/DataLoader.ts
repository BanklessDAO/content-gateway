import { ProgramError } from "@banklessdao/util-data";
import { SchemaInfo } from "@banklessdao/util-schema";
import * as TE from "fp-ts/TaskEither";
import { JobDescriptor } from ".";
import { InitContext } from "./context";
import { LoadContext } from "./context/LoadContext";
import { SaveContext } from "./context/SaveContext";

/**
 * The result of the loading operation. After `load` is
 * finished all the records that were loaded are transformed
 * into a the type `T` by
 */
export type LoadingResult<T> = {
    /**
     * The records that were loaded and transformed.
     */
    data: T[];
    /**
     * The cursor that was used to load the records.
     */
    cursor: string;
};

/**
 * A {@link DataLoader} implements a 2-phase loading mechanism with an optional
 * initialization. The steps are the following:
 * - initialize: this is where you can set the loader up. This usually means that
 *   you register the data type you want to load with the Content Gateway API
 * - load: this is where you load the data from an external data source and convert
 *   it to the type `T` (the one you registered)
 * - save: this is where you save the data to the Content Gateway API and reschedule
 *   the next job if necessary.
 */
export interface DataLoader<T> {
    info: SchemaInfo;
    /**
     * Initializes this loader. This will be called once each time
     * the application starts.
     */
    initialize: (deps: InitContext) => TE.TaskEither<ProgramError, void>;
    /**
     * Loads data from the data source asynchronously, and transforms the
     * data into the type `T`. This is the type that should be registered
     * with the Content Gateway.
     */
    load: (deps: LoadContext) => TE.TaskEither<ProgramError, LoadingResult<T>>;
    /**
     * Sends the data to the Content Gateway API asynchronously.
     * If you want to schedule a next job you can return a {@link JobDescriptor}
     * with the necessary information.
     */
    save: (
        deps: SaveContext<T>
    ) => TE.TaskEither<ProgramError, JobDescriptor | undefined>;
}
