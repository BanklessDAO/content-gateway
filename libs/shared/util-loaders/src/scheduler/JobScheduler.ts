import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import { Logger } from "tslog";
import { JobDescriptor } from ".";
import { DataLoader } from "../DataLoader";
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
import { Job } from "./Job";
import { JobRepository } from "./JobRepository";
import { JobState } from "./JobState";

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
    register: (
        loader: DataLoader<unknown>
    ) => TE.TaskEither<RegistrationError, void>;
    remove: (name: string) => TE.TaskEither<NoLoaderFoundError, void>;
    /**
     * Schedules a new job. The given job must have a corresponding loader
     * registered with the scheduler.
     * If a job with the same name is already scheduled, it will be overwritten.
     */
    schedule: (job: JobDescriptor) => TE.TaskEither<SchedulingError, Job>;

    /**
     * Stops this scheduler. It can't be used after this.
     */
    stop: () => TE.TaskEither<Error, void>;
};

export const createJobScheduler = (
    jobRepository: JobRepository,
    client: ContentGatewayClient
): JobScheduler => new DefaultJobScheduler(jobRepository, client);

class DefaultJobScheduler implements JobScheduler {
    // TODO: this implementation does way too much and it is also
    // TODO: suspectible to race conditions (because we can't adomically)
    // TODO: read and write the database
    // TODO: store an in-memory representation of the state too, to avoid
    // TODO: being suspended because of async/await
    private loaders = new Map<string, DataLoader<unknown>>();
    private started = false;
    private stopped = false;
    private client: ContentGatewayClient;
    private logger: Logger = new Logger({ name: "JobScheduler" });
    private scheduler = new ToadScheduler();
    private jobRepository: JobRepository;

    constructor(jobRepository: JobRepository, client: ContentGatewayClient) {
        this.jobRepository = jobRepository;
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
                await this.jobRepository.cleanStaleJobs()();
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

    register(
        loader: DataLoader<unknown>
    ): TE.TaskEither<RegistrationError, void> {
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
        jobDescriptor: JobDescriptor
    ): TE.TaskEither<SchedulingError, Job> {
        if (!this.started) {
            return TE.left(SchedulerNotStartedError.create());
        }
        if (this.stopped) {
            return TE.left(SchedulerStoppedError.create());
        }
        const job = { ...jobDescriptor, state: JobState.SCHEDULED };
        if (!this.loaders.has(job.name)) {
            this.logger.warn(`There is no loader with name ${job.name}`);
            // TODO: save it as failed?
            return TE.left(NoLoaderForJobError.create(job.name));
        }
        // TODO: check if job is already scheduled
        return pipe(
            this.jobRepository.upsertJob(
                job,
                "Scheduling new job for execution."
            ),
            TE.mapLeft((e) => {
                this.logger.warn(`Job scheduling failed:`, e);
                return JobCreationFailedError.create(job.name, e);
            }),
            TE.map(() => job)
        );
    }

    private async executeScheduledJobs() {
        try {
            this.logger.info(`Scanning for jobs. Current time: ${new Date()}`);
            const jobs = await this.jobRepository.loadNextJobs()();
            this.logger.info(`Found ${jobs.length} jobs.`);
            for (const job of jobs) {
                try {
                    this.logger.info(`Executing job ${job.name}.`);
                    // TODO: Consider using Bree later down the road
                    // TODO: for offloading jobs => https://github.com/breejs/bree
                    await this.executeJob(job);
                } catch (e) {
                    this.logger.warn("Failed to start job:", e);
                }
            }
        } catch (error: unknown) {
            this.logger.warn("Job execution error", error);
        }
    }

    private async executeJob(job: Job) {
        // TODO: maybe run this in a transaction for consistency?
        const loader = this.loaders.get(job.name);
        job.state = JobState.RUNNING;
        if (loader) {
            try {
                await this.jobRepository.upsertJob(
                    job,
                    `Job execution started.`
                )();
                pipe(
                    loader.load({
                        limit: job.limit,
                        cursor: job.cursor,
                    }),
                    TE.chain((data) =>
                        loader.save({
                            currentJob: job,
                            client: this.client,
                            jobScheduler: this,
                            data: data,
                        })
                    ),
                    TE.mapLeft((e) => {
                        this.logger.info(`Loader ${job.name} failed`, e);
                        this.jobRepository.upsertJob(
                            { ...job, state: JobState.FAILED },
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
                            this.jobRepository.upsertJob(
                                { ...job, state: JobState.COMPLETED },
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
            this.jobRepository.upsertJob(
                {
                    ...job,
                    state: JobState.CANCELED,
                },
                `Job was canceled because no loader with name ${job.name} was found.`
            )();
            this.logger.error(
                `No loader found for job ${job.name}. Job is cancelled.`
            );
        }
    }
}

export class JobSchedulerStub implements JobScheduler {
    starts = [] as boolean[];
    stops = [] as boolean[];
    loaders = [] as DataLoader<unknown>[];
    removedLoaders = [] as string[];
    scheduledJobs = [] as Job[];

    start(): TE.TaskEither<StartError, void> {
        this.starts.push(true);
        return TE.right(undefined);
    }
    register(
        loader: DataLoader<unknown>
    ): TE.TaskEither<RegistrationError, void> {
        this.loaders.push(loader);
        return TE.right(undefined);
    }
    remove(name: string): TE.TaskEither<NoLoaderFoundError, void> {
        this.removedLoaders.push(name);
        return TE.right(undefined);
    }
    schedule(
        jobDescriptor: JobDescriptor
    ): TE.TaskEither<SchedulingError, Job> {
        const job = { ...jobDescriptor, state: JobState.SCHEDULED };
        this.scheduledJobs.push(job);
        return TE.right(job);
    }
    stop(): TE.TaskEither<Error, void> {
        this.stops.push(true);
        return TE.of(undefined);
    }
}

export const createJobSchedulerStub = () => new JobSchedulerStub();
