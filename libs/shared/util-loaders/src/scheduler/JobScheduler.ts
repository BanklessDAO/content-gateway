import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { JobSchedule, JobState, PrismaClient } from "@cgl/prisma";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import { Logger } from "tslog";
import { Job } from ".";
import { DataLoader } from "../Loader";
import {
    JobCreationFailedError,
    LoaderAlreadyRegisteredError,
    NoLoaderForJobError,
    NoLoaderFoundError,
    RegistrationError,
    RemoveError,
    SchedulerAlreadyStartedError,
    SchedulerNotStartedError,
    SchedulerStartupError,
    SchedulerStoppedError,
    SchedulingError,
    StartError,
} from "./Errors";
import { JobDescriptor } from "./JobDescriptor";

/**
 * A job scheduler can be used to schedule loader {@link Job}s
 * to be executed at a later time.
 */
export type JobScheduler = {
    /**
     * Starts this scheduler.
     */
    start: () => TE.TaskEither<StartError, void>;
    /**
     * Registers the given loader with the given name.
     */
    register: (loader: DataLoader) => TE.TaskEither<RegistrationError, void>;
    remove: (name: string) => TE.TaskEither<NoLoaderFoundError, void>;
    /**
     * Schedules a new job. The given job must have a corresponding loader
     * registered with the scheduler.
     * If a job with the same name is already scheduled, it will be overwritten.
     */
    schedule: (
        job: JobDescriptor
    ) => TE.TaskEither<SchedulingError, JobDescriptor>;

    /**
     * Stops this scheduler. It can't be used after this.
     */
    stop: () => TE.TaskEither<Error, void>;
};

export const createJobScheduler = (
    prisma: PrismaClient,
    client: ContentGatewayClient
): JobScheduler => new DefaultJobScheduler(prisma, client);

class DefaultJobScheduler implements JobScheduler {
    // TODO: this implementation does way too much and it is also
    // TODO: suspectible to race conditions (because we can't adomically)
    // TODO: read and write the database
    // TODO: store an in-memory representation of the state too, to avoid
    // TODO: being suspended because of async/await
    private loaders = new Map<string, DataLoader>();
    private started = false;
    private stopped = false;
    private prisma: PrismaClient;
    private client: ContentGatewayClient;
    private logger: Logger = new Logger({ name: "JobScheduler" });
    private scheduler = new ToadScheduler();

    constructor(prisma: PrismaClient, client: ContentGatewayClient) {
        this.prisma = prisma;
        this.client = client;
    }

    start(): TE.TaskEither<StartError, void> {
        if (this.started) {
            this.logger.warn("Job scheduler already started.");
            return TE.left(SchedulerAlreadyStartedError.create());
        }
        this.logger.info("Starting job scheduler.");
        this.started = true;
        this.stopped = false;
        return TE.tryCatch(
            async () => {
                await this.cleanStaleJobs();
                const task = new AsyncTask(
                    "Execute Jobs",
                    () => {
                        return this.executeScheduledJobs();
                    },
                    (err) => {
                        this.logger.info("Job execution failed", err);
                    }
                );
                const job = new SimpleIntervalJob({ seconds: 5 }, task);
                this.scheduler.addSimpleIntervalJob(job);
            },
            (e: unknown) => {
                return SchedulerStartupError.create(e);
            }
        );
    }

    stop() {
        if (this.stopped) {
            this.logger.warn("Job scheduler already stopped.");
            return TE.left(SchedulerStoppedError.create());
        }
        this.logger.info("Stopping job scheduler.");
        this.stopped = true;
        this.started = false;
        this.scheduler.stop();
        return TE.of(undefined);
    }

    register(loader: DataLoader): TE.TaskEither<RegistrationError, void> {
        if (!this.started) {
            return TE.left(SchedulerNotStartedError.create());
        }
        if (this.stopped) {
            return TE.left(SchedulerStoppedError.create());
        }
        if (this.loaders.has(loader.name)) {
            this.logger.error(
                `A loader by name ${loader.name} already exists.`
            );
            return TE.left(LoaderAlreadyRegisteredError.create(loader.name));
        }
        this.logger.info(`Registering loader with name ${loader.name}.`);
        this.loaders.set(loader.name, loader);
        return loader.initialize({
            client: this.client,
            jobScheduler: this,
        });
    }

    remove(name: string): TE.TaskEither<RemoveError, void> {
        if (!this.started) {
            return TE.left(SchedulerNotStartedError.create());
        }
        if (this.stopped) {
            return TE.left(SchedulerStoppedError.create());
        }
        if (this.loaders.has(name)) {
            this.loaders.delete(name);
            return TE.right(undefined);
        } else {
            return TE.left(NoLoaderFoundError.create(name));
        }
    }

    schedule(
        job: JobDescriptor
    ): TE.TaskEither<SchedulingError, JobDescriptor> {
        if (!this.started) {
            return TE.left(SchedulerNotStartedError.create());
        }
        if (this.stopped) {
            return TE.left(SchedulerStoppedError.create());
        }
        if (!this.loaders.has(job.name)) {
            this.logger.warn(`There is no loader with name ${job.name}`);
            // TODO: save it as failed?
            return TE.left(NoLoaderForJobError.create(job.name));
        }
        // TODO: check if job is already scheduled
        return pipe(
            this.upsertJob(
                job,
                JobState.SCHEDULED,
                "Scheduling new job for execution."
            ),
            TE.mapLeft((e) => {
                this.logger.warn(`Job scheduling failed:`, e);
                return JobCreationFailedError.create(job.name, e);
            }),
            TE.map(() => job)
        );
    }

    private async cleanStaleJobs() {
        const staleJobs = await this.prisma.jobSchedule.findMany({
            where: {
                state: JobState.RUNNING,
            },
        });
        await Promise.all(
            staleJobs.map((job) => {
                return this.upsertJob(
                    this.jobScheduleToJob(job, DateTime.now()),
                    JobState.FAILED,
                    `Job ${job.name} was in RUNNING state after application started. Setting state to FAILED.`
                )();
            })
        );
    }

    private async loadNextJobs() {
        return this.prisma.jobSchedule.findMany({
            where: {
                state: JobState.SCHEDULED,
                scheduledAt: {
                    lte: DateTime.local().toJSDate(),
                },
            },
        });
    }

    private async executeScheduledJobs() {
        try {
            this.logger.info(`Scanning for jobs. Current time: ${new Date()}`);
            const jobs = await this.loadNextJobs();
            this.logger.info(`Found ${jobs.length} jobs.`);
            for (const job of jobs) {
                try {
                    this.logger.info(`Executing job ${job.name}.`);
                    // TODO: Consider using Bree later down the road
                    // TODO: for offloading jobs => https://github.com/breejs/bree
                    await this.executeJob(
                        this.jobScheduleToJob(job, DateTime.now())
                    );
                } catch (e) {
                    this.logger.warn("Failed to start job:", e);
                }
            }
        } catch (error: unknown) {
            this.logger.warn("Job execution error", error);
        }
    }

    private async executeJob(job: Job) {
        const loader = this.loaders.get(job.name);
        if (loader) {
            try {
                await this.upsertJob(
                    job,
                    JobState.RUNNING,
                    `Job execution started.`
                )();
                pipe(
                    loader.store({
                        client: this.client,
                        currentJob: job,
                        jobScheduler: this,
                    }),
                    TE.mapLeft((e) => {
                        this.logger.info(`Loader ${job.name} failed`, e);
                        this.upsertJob(
                            job,
                            JobState.FAILED,
                            `Loader ${job.name} failed: ${e.message}`
                        )();
                        return e;
                    }),
                    TE.map((nextJob) => {
                        if (nextJob) {
                            this.logger.info(
                                "A next job was returned, scheduling..."
                            );
                            this.schedule(nextJob);
                        } else {
                            this.upsertJob(
                                job,
                                JobState.COMPLETED,
                                `Job ${job.name} completed successfully.`
                            )();
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
            this.upsertJob(
                job,
                JobState.CANCELED,
                `Job was canceled because no loader with name ${job.name} was found.`
            )();
            this.logger.error(
                `No loader found for job ${job.name}. Job is cancelled.`
            );
        }
    }

    private upsertJob(
        job: JobDescriptor,
        state: JobState,
        note: string
    ): TE.TaskEither<Error, JobSchedule> {
        this.logger.info(
            `Updating job ${job.name} with state ${state} and note '${note}'.`
        );
        return TE.tryCatch(
            async () => {
                const jobSchedule = {
                    name: job.name,
                    cursor: job.cursor,
                    state: state,
                    scheduledAt: job.scheduledAt,
                    updatedAt: new Date(),
                    log: {
                        create: {
                            state: state,
                            log: note,
                        },
                    },
                };
                return this.prisma.jobSchedule.upsert({
                    where: {
                        name: job.name,
                    },
                    create: jobSchedule,
                    update: jobSchedule,
                });
            },
            (err: unknown) => {
                this.logger.warn(
                    `Couldn't update job ${job.name} to state ${state}. Cause:`,
                    err
                );
                return new Error(String(err));
            }
        );
    }

    private jobScheduleToJob(
        jobSchedule: JobSchedule,
        startedAt: DateTime
    ): Job {
        return {
            name: jobSchedule.name,
            scheduledAt: jobSchedule.scheduledAt,
            cursor: jobSchedule.cursor || undefined,
            execututionStartedAt: startedAt.toJSDate(),
        };
    }

    private jobToJobSchedule(job: Job, state: JobState): JobSchedule {
        return {
            name: job.name,
            cursor: job.cursor || null,
            state: state,
            scheduledAt: job.scheduledAt,
            updatedAt: new Date(),
        };
    }
}

export class JobSchedulerStub implements JobScheduler {
    starts = [] as boolean[];
    stops = [] as boolean[];
    loaders = [] as DataLoader[];
    removedLoaders = [] as string[];
    scheduledJobs = [] as JobDescriptor[];

    start(): TE.TaskEither<StartError, void> {
        this.starts.push(true);
        return TE.right(undefined);
    }
    register(loader: DataLoader): TE.TaskEither<RegistrationError, void> {
        this.loaders.push(loader);
        return TE.right(undefined);
    }
    remove(name: string): TE.TaskEither<NoLoaderFoundError, void> {
        this.removedLoaders.push(name);
        return TE.right(undefined);
    }
    schedule(
        job: JobDescriptor
    ): TE.TaskEither<SchedulingError, JobDescriptor> {
        this.scheduledJobs.push(job);
        return TE.right(job);
    }
    stop(): TE.TaskEither<Error, void> {
        this.stops.push(true);
        return TE.of(undefined);
    }
}

export const createJobSchedulerStub = () => new JobSchedulerStub();
