import { SchemaInfo } from "@shared/util-schema";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Job } from ".";
import { DatabaseError } from "./errors";

export type JobRepository = {
    findJob: (info: SchemaInfo) => TO.TaskOption<Job | null>;
    upsertJob: (
        job: Job,
        note: string,
        info: Record<string, unknown>
    ) => TE.TaskEither<DatabaseError, Job>;
    loadNextJobs: () => T.Task<Job[]>;
};
