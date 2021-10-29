import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { JobSchedule, JobState, PrismaClient } from "@cgl/prisma";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import * as schedule from "node-schedule";
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
    register: (loader: Loader) => Promise<E.Either<RegistrationError, void>>;
    remove: (name: string) => E.Either<NoLoaderFoundError, void>;
    /**
     * Schedules a job and returns its name. The given job must have a
     * corresponding loader registered with the scheduler.
     * If a job with the same name is already scheduled, it will be overwritten.
     */
    schedule: (
        job: JobDescriptor
    ) => Promise<E.Either<SchedulingError, string>>;
};

export class JobSchedulerStub implements JobScheduler {
    starts = [] as boolean[];
    loaders = [] as Loader[];
    removedLoaders = [] as string[];
    scheduledJobs = [] as JobDescriptor[];

    start(): Promise<E.Either<StartError, void>> {
        this.starts.push(true);
        return Promise.resolve(E.right(undefined));
    }
    register(loader: Loader): Promise<E.Either<RegistrationError, void>> {
        this.loaders.push(loader);
        return Promise.resolve(E.right(undefined));
    }
    remove(name: string): E.Either<NoLoaderFoundError, void> {
        this.removedLoaders.push(name);
        return E.right(undefined);
    }
    schedule(job: JobDescriptor): Promise<E.Either<SchedulingError, string>> {
        this.scheduledJobs.push(job);
        return Promise.resolve(E.right(""));
    }
}

export const createJobSchedulerStub = () => new JobSchedulerStub();

export const createJobScheduler = (
    prisma: PrismaClient,
    client: ContentGatewayClient
): JobScheduler => new DefaultJobScheduler(prisma, client);

class DefaultJobScheduler implements JobScheduler {
    private loaders = new Map<string, Loader>();
    private started = false;
    private prisma: PrismaClient;
    private client: ContentGatewayClient;
    private logger: Logger = new Logger({ name: "JobScheduler" });

    constructor(prisma: PrismaClient, client: ContentGatewayClient) {
        this.prisma = prisma;
        this.client = client;
    }

    start(): Promise<E.Either<StartError, void>> {
        if (this.started) {
            this.logger.warn("Job scheduler already started.");
            return TE.left(SchedulerAlreadyStartedError.create())();
        }
        this.logger.info("Starting job scheduler.");
        this.started = true;
        return TE.tryCatch(
            async () => {
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

    register(loader: Loader): Promise<E.Either<RegistrationError, void>> {
        if (!this.started) {
            this.logger.error(
                "Can't register a loader before the scheduler is started."
            );
            return TE.left(SchedulerNotStartedError.create())();
        }
        if (this.loaders.has(loader.name)) {
            this.logger.error(
                `A loader by name ${loader.name} already exists.`
            );
            return TE.left(LoaderAlreadyRegisteredError.create(loader.name))();
        }
        this.logger.info(`Registering loader with name ${loader.name}.`);
        this.loaders.set(loader.name, loader);
        return loader.initialize({
            client: this.client,
            jobScheduler: this,
        })();
    }

    remove(name: string): E.Either<NoLoaderFoundError, void> {
        if (this.loaders.has(name)) {
            this.loaders.delete(name);
            return E.right(undefined);
        } else {
            return E.left(NoLoaderFoundError.create(name));
        }
    }

    schedule(job: JobDescriptor): Promise<E.Either<SchedulingError, string>> {
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
                    const entry = {
                        name: job.name,
                        cursor: job.cursor,
                        scheduledAt: job.scheduledAt.toJSDate(),
                        updatedAt: new Date(),
                    };
                    const result = await this.prisma.jobSchedule.upsert({
                        where: {
                            name: job.name,
                        },
                        create: entry,
                        update: entry,
                    });
                    this.logger.info("Job created:", result);
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

    private loadNextJobs() {
        return this.prisma.jobSchedule.findMany({
            where: {
                state: JobState.SCHEDULED,
                scheduledAt: {
                    lte: DateTime.local().toJSDate(),
                },
            },
        });
    }

    private updateJob(
        job: Job,
        state: JobState,
        note: string
    ): TE.TaskEither<Error, JobSchedule> {
        this.logger.info(
            `Updating job ${job.name} with state ${state} and note '${note}'.`
        );
        return TE.tryCatch(
            async () => {
                return this.prisma.jobSchedule.update({
                    where: {
                        name: job.name,
                    },
                    data: {
                        scheduledAt: new Date(0),
                        state: state,
                        cursor: null,
                        log: {
                            create: {
                                state: state,
                                log: note,
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
                return err;
            }
        );
    }

    private async executeJob(job: Job) {
        const loader = this.loaders.get(job.name);
        if (loader) {
            try {
                await this.updateJob(
                    job,
                    JobState.RUNNING,
                    `Job execution started.`
                )();
                pipe(
                    loader.load({
                        client: this.client,
                        currentJob: job,
                        jobScheduler: this,
                    }),
                    TE.mapLeft((e) => {
                        this.logger.info(`Loader ${job.name} failed`, e);
                        this.updateJob(
                            job,
                            JobState.FAILED,
                            `Loader ${job.name} failed: ${e.message}`
                        )();
                        return e;
                    }),
                    TE.map((r) => {
                        this.updateJob(
                            job,
                            JobState.COMPLETED,
                            `Job ${job.name} completed successfully.`
                        )();
                        return r;
                    }),
                    TE.map((nextJob) => {
                        if (nextJob) {
                            this.schedule(nextJob);
                        }
                    })
                )();
            } catch (e: unknown) {
                this.logger.error(
                    "Job failed. This shouldn't have happened. There is probably a bug.",
                    e
                );
            }
        } else {
            this.updateJob(
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
                for (const job of jobs) {
                    try {
                        this.logger.info(`Executing job ${job.name}.`);
                        await this.executeJob(
                            jobScheduleToJob(job, DateTime.now())
                        );
                    } catch (e) {
                        this.logger.warn("Failed to start job:", e);
                    }
                }
            } catch (error: unknown) {
                this.logger.warn("Job execution error", error);
            }
        };
    }
}

const jobScheduleToJob = (js: JobSchedule, startedAt: DateTime): Job => ({
    name: js.name,
    scheduledAt: DateTime.fromJSDate(js.scheduledAt),
    cursor: js.cursor,
    execututionStartedAt: startedAt,
});
