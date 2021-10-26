import { PrismaClient } from "@cgl/prisma";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { job as createJob, start } from "microjob";
import { Loader } from ".";
import { JobDescriptor } from "./JobDescriptor";

export class NoLoaderForJobError extends Error {
    public _tag = "NoLoaderForJobError";

    private constructor(name: string) {
        super(`No loader found for name: ${name}`);
    }

    public static create(name: string): NoLoaderForJobError {
        return new NoLoaderForJobError(name);
    }
}

export class LoaderAlreadyRegisteredError extends Error {
    public _tag = "LoaderAlreadyRegisteredError";

    private constructor(name: string) {
        super(`There is already a loader with name: ${name}`);
    }

    public static create(name: string): LoaderAlreadyRegisteredError {
        return new LoaderAlreadyRegisteredError(name);
    }
}

export class NoLoaderFoundError extends Error {
    public _tag = "NoLoaderFoundError";

    private constructor(name: string) {
        super(`No loader found with name: ${name}`);
    }

    public static create(name: string): NoLoaderFoundError {
        return new NoLoaderFoundError(name);
    }
}

export class JobCreationFailedError extends Error {
    public _tag = "JobCreationFailedError";

    private constructor(name: string, cause: Error) {
        super(`Creation of job with name: ${name} failed. Cause: ${cause}`);
    }

    public static create(name: string, cause: Error): JobCreationFailedError {
        return new JobCreationFailedError(name, cause);
    }
}

export class JobSchedulerAlreadyStartedError extends Error {
    public _tag = "JobSchedulerAlreadyStartedError";

    private constructor() {
        super(`This job scheduler has already started.`);
    }

    public static create(): JobSchedulerAlreadyStartedError {
        return new JobSchedulerAlreadyStartedError();
    }
}

export class JobSchedulerStartupError extends Error {
    public _tag = "JobSchedulerStartupError";

    private constructor(cause: Error) {
        super(`Couldn't start job scheduler. Cause: ${cause}`);
    }

    public static create(cause: Error): JobSchedulerStartupError {
        return new JobSchedulerStartupError(cause);
    }
}

export type JobSchedulerError =
    | NoLoaderForJobError
    | LoaderAlreadyRegisteredError
    | NoLoaderFoundError
    | JobCreationFailedError
    | JobSchedulerAlreadyStartedError
    | JobSchedulerStartupError;

/**
 * A job scheduler can be used to schedule loader {@link Job}s
 * to be executed at a later time.
 */
export type JobScheduler = {
    /**
     * Starts this scheduler.
     */
    start: () => TE.TaskEither<JobSchedulerError, void>;
    /**
     * Registers the given loader with the given name.
     */
    register: <T, D>(
        name: string,
        loader: Loader<T, D>
    ) => E.Either<JobSchedulerError, void>;
    remove: (name: string) => E.Either<JobSchedulerError, void>;
    /**
     * Schedules a job and returns its id. The given job must have a
     * corresponding loader registered with the scheduler.
     */
    schedule: <D>(
        job: JobDescriptor<D>
    ) => TE.TaskEither<JobSchedulerError, string>;
};

export const createScheduler: (prisma: PrismaClient) => JobScheduler = (
    prisma
) => {
    const map = new Map<string, Loader<any, any>>();
    let started = false;

    const result: JobScheduler = {
        start: () => {
            if (started) {
                return TE.left(JobSchedulerAlreadyStartedError.create());
            }
            started = true;
            return TE.tryCatch(
                () => {
                    return Promise.all([
                        start(),
                        createJob(() => {
                            return 1;
                        }),
                    ]).then(() => {
                        return undefined;
                    });
                },
                (e: Error) => {
                    return JobSchedulerStartupError.create(e);
                }
            );
        },
        register: <T, D>(
            name: string,
            loader: Loader<T, D>
        ): E.Either<JobSchedulerError, void> => {
            if (map.has(name)) {
                return E.left(LoaderAlreadyRegisteredError.create(name));
            }
            map.set(name, loader);
            throw new Error("Function not implemented.");
        },
        remove: (name: string) => {
            if (map.has(name)) {
                map.delete(name);
                return E.right(undefined);
            } else {
                return E.left(NoLoaderFoundError.create(name));
            }
        },
        schedule: <D>(job: JobDescriptor<D>) => {
            if (!map.has(job.name)) {
                return TE.left(NoLoaderForJobError.create(job.name));
            }
            return pipe(
                TE.tryCatch(
                    () => {
                        return prisma.job.create({
                            data: {
                                name: job.name,
                                data: job.data,
                            },
                        });
                    },
                    (e: Error) => {
                        return JobCreationFailedError.create(job.name, e);
                    }
                ),
                TE.map((j) => j.name)
            );
        },
    };
    return result;
};
