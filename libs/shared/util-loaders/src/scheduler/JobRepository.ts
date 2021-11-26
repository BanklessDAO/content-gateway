import { SchemaInfo } from "@shared/util-schema";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Job, JobDescriptor } from ".";
import { DatabaseError } from "./errors";

export type JobRepository = {
    findJob: (info: SchemaInfo) => TO.TaskOption<JobDescriptor | null>;
    upsertJob: (job: Job, note: string) => TE.TaskEither<DatabaseError, Job>;
    rescheduleFailedJob: (job: Job) => TE.TaskEither<DatabaseError, void>;
    cleanStaleJobs: () => TE.TaskEither<DatabaseError, void>;
    loadNextJobs: () => T.Task<Job[]>;
};
