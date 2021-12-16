import { SchemaInfo } from "@banklessdao/util-schema";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import {
    DataLoader,
    Job,
    JobDescriptor,
    RegistrationError, SchedulingError
} from "..";

/**
 * You can access all the {@link Job}s in the system using this object,
 * and you can also register new loaders and schedule new Jobs.
 */
export type Jobs = {
    findAll: () => T.Task<Array<Job>>;
    findJob: (info: SchemaInfo) => TO.TaskOption<Job | null>;
    /**
     * Registers the given loader with the given name.
     */
    register: (
        loader: DataLoader<unknown>
    ) => TE.TaskEither<RegistrationError, void>;
    /**
     * Schedules a new job. The given job must have a corresponding loader
     * registered with the scheduler.
     * If a job with the same name is already scheduled, it will be overwritten.
     */
    schedule: (job: JobDescriptor) => TE.TaskEither<SchedulingError, Job>;
};
