import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { Job } from ".";

export type JobRepository = {
    upsertJob: (
        job: Job,
        note: string
    ) => TE.TaskEither<Error, Job>;

    cleanStaleJobs: () => TE.TaskEither<Error, void>;

    loadNextJobs: () => T.Task<Job[]>;
};
