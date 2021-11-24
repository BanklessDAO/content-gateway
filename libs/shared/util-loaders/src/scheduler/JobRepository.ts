import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { Job } from ".";
import { DatabaseError } from "./errors";

export type JobRepository = {
    upsertJob: (job: Job, note: string) => TE.TaskEither<DatabaseError, Job>;

    rescheduleFailedJob: (
        job: Job
    ) => TE.TaskEither<DatabaseError, void>;

    cleanStaleJobs: () => TE.TaskEither<DatabaseError, void>;

    loadNextJobs: () => T.Task<Job[]>;
};
