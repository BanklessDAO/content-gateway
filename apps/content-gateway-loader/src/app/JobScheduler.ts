import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { JobState, PrismaClient } from "@cgl/prisma";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { job as createJob, start } from "microjob";
import * as schedule from "node-schedule";
import * as os from "os";
import { Logger } from "tslog";
import { Job, Loader } from ".";
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

export class SchedulerAlreadyStartedError extends Error {
    public _tag = "JobSchedulerAlreadyStartedError";

    private constructor() {
        super(`This job scheduler has already started.`);
    }

    public static create(): SchedulerAlreadyStartedError {
        return new SchedulerAlreadyStartedError();
    }
}

export class SchedulerStartupError extends Error {
    public _tag = "JobSchedulerStartupError";

    private constructor(cause: Error) {
        super(`Couldn't start job scheduler. Cause: ${cause}`);
    }

    public static create(cause: Error): SchedulerStartupError {
        return new SchedulerStartupError(cause);
    }
}

export class SchedulerNotStartedError extends Error {
    public _tag = "SchedulerNotStartedError";

    private constructor() {
        super("The job scheduler is not started yet.");
    }

    public static create(): SchedulerNotStartedError {
        return new SchedulerNotStartedError();
    }
}

export type StartError = SchedulerAlreadyStartedError | SchedulerStartupError;

export type SchedulingError =
    | NoLoaderFoundError
    | JobCreationFailedError
    | SchedulerNotStartedError;

export type RegistrationError = LoaderAlreadyRegisteredError | Error;

/**
 * A job scheduler can be used to schedule loader {@link Job}s
 * to be executed at a later time.
 */
export type JobScheduler = {
    /**
     * Starts this scheduler.
     */
    start: () => Promise<E.Either<StartError, void>>;
    /**
     * Registers the given loader with the given name.
     */
    register: <T>(
        loader: Loader<T>
    ) => Promise<E.Either<RegistrationError, void>>;
    remove: (name: string) => E.Either<NoLoaderFoundError, void>;
    /**
     * Schedules a job and returns its name. The given job must have a
     * corresponding loader registered with the scheduler.
     * If a job with the same name is already scheduled, it will be overwritten.
     */
    schedule: <D>(
        job: JobDescriptor<D>
    ) => Promise<E.Either<SchedulingError, string>>;
};

export const createJobScheduler = (
    prisma: PrismaClient,
    client: ContentGatewayClient
): JobScheduler => new DefaultJobScheduler(prisma, client);

class DefaultJobScheduler implements JobScheduler {
    private loaders = new Map<string, Loader<unknown>>();
    private started = false;
    private prisma: PrismaClient;
    private client: ContentGatewayClient;
    private logger: Logger = new Logger({ name: "JobScheduler" });

    constructor(prisma: PrismaClient, client: ContentGatewayClient) {
        this.prisma = prisma;
        this.client = client;
    }

    private loadNextJobs() {
        return this.prisma.job.findMany({
            where: {
                scheduledAt: {
                    lte: DateTime.local().toJSDate(),
                },
            },
        });
    }

    private finishJob(job: Job<void>, state: JobState, note: string) {
        this.logger.info(
            `Finishing job ${job.name} with state ${state} and note ${note}`
        );
        return TE.tryCatch(
            async () => {
                await this.prisma.job.update({
                    where: {
                        name: job.name,
                    },
                    data: {
                        scheduledAt: new Date(0),
                        state: state,
                        data: null,
                        cursor: null,
                        limit: null,
                        jobExecutions: {
                            create: {
                                finalState: state,
                                note: note,
                                finishedAt: new Date(),
                            },
                        },
                    },
                });
            },
            (err: Error) => {
                this.logger.warn(
                    `Couldn't update job ${job.name} to state ${state}. Cause:`,
                    err
                );
            }
        );
    }

    private executeJob(job: Job<void>) {
        const loader = this.loaders.get(job.name);
        if (loader) {
            createJob(() => {
                pipe(
                    loader.load({
                        client: this.client,
                        currentJob: job,
                        jobScheduler: this,
                    }),
                    TE.mapLeft((e) => {
                        this.finishJob(
                            job,
                            JobState.FAILED,
                            `Loader ${job.name} failed: ${e.message}`
                        )();
                        return e;
                    }),
                    TE.chainFirst(() => {
                        return TE.tryCatch(
                            async () => {
                                await this.finishJob(
                                    job,
                                    JobState.COMPLETED,
                                    `Job ${job.name} completed successfully.`
                                )();
                            },
                            (err: Error) => err
                        );
                    }),
                    TE.map((nextJob) => {
                        if (nextJob) {
                            this.schedule(nextJob);
                        }
                    })
                )();
            });
        } else {
            this.finishJob(
                job,
                JobState.CANCELED,
                `Job was canceled because no loader with name ${job.name} was found.`
            );
            this.logger.error(
                `No loader found for job ${job.name}. Job is cancelled.`
            );
        }
    }

    private createJobScannerTask() {
        return async () => {
            try {
                this.logger.info(
                    `Scanning for jobs. Current time: ${DateTime.now()}`
                );
                const jobs = await this.loadNextJobs();
                this.logger.info(`Found ${jobs.length} jobs.`);
                jobs.forEach((job) => {
                    this.executeJob({
                        name: job.name,
                        scheduledAt: DateTime.fromJSDate(job.scheduledAt),
                        execututionStartedAt: DateTime.now(),
                        cursor: job.cursor
                            ? DateTime.fromJSDate(job.cursor)
                            : undefined,
                        limit: job.limit,
                        // TODO: 📙  implement this later
                        data: undefined,
                    });
                });
            } catch (error: unknown) {
                this.logger.warn("Job execution error", error);
            }
        };
    }

    start() {
        if (this.started) {
            this.logger.warn("Job scheduler already started.");
            return Promise.resolve(
                E.left(SchedulerAlreadyStartedError.create())
            );
        }
        this.logger.info("Starting job scheduler.");
        this.started = true;
        return TE.tryCatch(
            async () => {
                const workerCount = Math.max(2, os.cpus().length);
                this.logger.info(`Worker count is: ${workerCount}`);
                await start({ maxWorkers: workerCount });
                const everyMinute = "0 0/1 0 ? * * *";
                const every5SEconds = "*/5 * * * * *";
                schedule.scheduleJob(
                    every5SEconds,
                    this.createJobScannerTask()
                );
            },
            (e: Error) => {
                return SchedulerStartupError.create(e);
            }
        )();
    }

    register<T>(loader: Loader<T>): Promise<E.Either<RegistrationError, void>> {
        if (!this.started) {
            this.logger.error(
                "Can't register a loader before the scheduler is started."
            );
            return Promise.resolve(E.left(SchedulerNotStartedError.create()));
        }
        if (this.loaders.has(loader.name)) {
            this.logger.error(
                `A loader by name ${loader.name} already exists.`
            );
            return Promise.resolve(
                E.left(LoaderAlreadyRegisteredError.create(loader.name))
            );
        }
        this.logger.info(`Registering loader with name ${loader.name}.`);
        this.loaders.set(loader.name, loader);
        return loader.initialize({
            client: this.client,
            jobScheduler: this,
        })();
    }

    remove(name: string) {
        if (this.loaders.has(name)) {
            this.loaders.delete(name);
            return E.right(undefined);
        } else {
            return E.left(NoLoaderFoundError.create(name));
        }
    }

    schedule<D>(job: JobDescriptor<D>) {
        if (!this.started) {
            this.logger.warn("Job scheduler not started.");
            return TE.left(SchedulerNotStartedError.create())();
        }
        if (!this.loaders.has(job.name)) {
            this.logger.warn(`There is no loader with name ${job.name}`);
            return TE.left(NoLoaderForJobError.create(job.name))();
        }
        return pipe(
            TE.tryCatch(
                async () => {
                    this.logger.info(
                        "Creating new job:",
                        job.scheduledAt.toJSDate()
                    );
                    const entity = {
                        name: job.name,
                        cursor: job.cursor ? job.cursor.toJSDate() : null,
                        limit: job.limit,
                        scheduledAt: job.scheduledAt.toJSDate(),
                        data: job.data,
                    };
                    const result = await this.prisma.job.create({
                        data: entity,
                    });
                    this.logger.info(`Job created: ${result}`);
                    return result;
                },
                (e: Error) => {
                    this.logger.warn(`Job creation failed:`, e);
                    return JobCreationFailedError.create(job.name, e);
                }
            ),
            TE.map((r) => r.name)
        )();
    }
}
