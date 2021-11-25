import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { ProgramError } from "@shared/util-dto";
import { createLogger } from "@shared/util-fp";
import { schemaInfoToString } from "@shared/util-schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import { JobDescriptor } from ".";
import { DataLoader } from "../DataLoader";
import {
    JobCreationError as JobUpsertError,
    LoaderInitializationError,
    NoLoaderForJobError,
    RegistrationError,
    SchedulerNotRunningError,
    SchedulerStartupError,
    SchedulingError
} from "./errors";
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
    start: () => TE.TaskEither<SchedulerStartupError, void>;
    /**
     * Registers the given loader with the given name.
     */
    register: (
        loader: DataLoader<unknown>
    ) => TE.TaskEither<RegistrationError, void>;
    remove: (name: string) => E.Either<RegistrationError, void>;
    /**
     * Schedules a new job. The given job must have a corresponding loader
     * registered with the scheduler.
     * If a job with the same name is already scheduled, it will be overwritten.
     */
    schedule: (job: JobDescriptor) => TE.TaskEither<SchedulingError, Job>;

    /**
     * Stops this scheduler. It can't be used after this.
     */
    stop: () => void;
};

export type Deps = {
    jobRepository: JobRepository;
    contentGatewayClient: ContentGatewayClient;
};

export const createJobScheduler = (deps: Deps): JobScheduler =>
    new DefaultJobScheduler(deps);

class DefaultJobScheduler implements JobScheduler {
    private loaders = new Map<string, DataLoader<unknown>>();
    private running = false;
    private client: ContentGatewayClient;
    private logger = createLogger("JobScheduler");
    private scheduler = new ToadScheduler();
    private jobRepository: JobRepository;

    constructor(deps: Deps) {
        this.jobRepository = deps.jobRepository;
        this.client = deps.contentGatewayClient;
    }

    start(): TE.TaskEither<SchedulerStartupError, void> {
        if (this.running) {
            return TE.right(undefined);
        }
        this.logger.info("Starting job scheduler.");
        this.running = true;
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
                this.scheduler.addSimpleIntervalJob(
                    new SimpleIntervalJob({ seconds: 5 }, task)
                );
            },
            (e: unknown) => {
                return new SchedulerStartupError(e);
            }
        );
    }

    register(
        loader: DataLoader<unknown>
    ): TE.TaskEither<RegistrationError, void> {
        const key = schemaInfoToString(loader.info);
        if (!this.running) {
            return TE.left(new SchedulerNotRunningError());
        }
        if (this.loaders.has(key)) {
            this.logger.info(
                `A loader by key ${key} already exists, overwriting...`
            );
        } else {
            this.logger.info(`Registering loader with key ${key}.`);
        }
        this.loaders.set(key, loader);
        return pipe(
            loader.initialize({
                client: this.client,
                jobScheduler: this,
            }),
            TE.mapLeft((e) => new LoaderInitializationError(e))
        );
    }

    schedule(
        jobDescriptor: JobDescriptor
    ): TE.TaskEither<SchedulingError, Job> {
        const key = schemaInfoToString(jobDescriptor.info);
        if (!this.running) {
            return TE.left(new SchedulerNotRunningError());
        }
        if (!this.loaders.has(key)) {
            return this.cancelJob(jobDescriptor);
        }
        return this.scheduleJob(jobDescriptor);
    }

    stop() {
        if (!this.running) {
            return;
        }
        this.logger.info("Stopping job scheduler.");
        this.running = false;
        this.scheduler.stop();
    }

    remove(name: string): E.Either<SchedulerNotRunningError, void> {
        if (!this.running) {
            return E.left(new SchedulerNotRunningError());
        }
        if (this.loaders.has(name)) {
            this.loaders.delete(name);
        }
        return E.right(undefined);
    }

    private async executeScheduledJobs() {
        this.logger.info(`Scanning for jobs. Current time: ${new Date()}`);
        const jobs = await this.jobRepository.loadNextJobs()();
        this.logger.info(`Found ${jobs.length} jobs.`);
        for (const job of jobs) {
            this.logger.info(`Executing job for:`, job.info);
            // TODO: Consider using Bree later down the road
            // TODO: for offloading jobs => https://github.com/breejs/bree
            this.executeJob(job)();
        }
    }

    private executeJob(job: Job): TE.TaskEither<ProgramError, void> {
        job.state = JobState.RUNNING;
        const key = schemaInfoToString(job.info);
        return pipe(
            TE.Do,
            TE.bind("job", () => this.jobRepository.upsertJob(job, "Starting job.")),
            TE.bindW("loader", () =>
                pipe(
                    O.fromNullable(this.loaders.get(key)),
                    TE.fromOption(() => new NoLoaderForJobError(job)),
                    TE.mapLeft((e) => {
                        this.cancelJob(job)();
                        return e;
                    })
                )
            ),
            TE.bind("result", ({ loader }) =>
                loader.load({
                    limit: job.limit,
                    cursor: job.cursor,
                })
            ),
            TE.chain(({ loader, result }) =>
                loader.save({
                    currentJob: job,
                    client: this.client,
                    jobScheduler: this,
                    loadingResult: result,
                })
            ),
            TE.mapLeft((e) => {
                return this.failJob(job, e);
            }),
            this.scheduleOrCompleteJobOnSuccess(job)
        );
    }

    private scheduleOrCompleteJobOnSuccess(job: JobDescriptor) {
        return TE.map((nextJob: JobDescriptor | undefined) => {
            if (nextJob) {
                this.logger.info(
                    "A next job was returned, scheduling...",
                    nextJob
                );
                this.schedule(nextJob)();
            } else {
                this.logger.info(
                    "No next job was returned, completing job",
                    job
                );
                this.upsertJob(
                    job,
                    `Job ${schemaInfoToString(
                        job.info
                    )} completed successfully.`,
                    JobState.COMPLETED
                )();
            }
        });
    }

    private failJob<E>(jobDescriptor: JobDescriptor, e: E) {
        const msg = `Loader ${schemaInfoToString(jobDescriptor.info)} failed`;
        this.logger.warn(msg, e);
        pipe(
            this.upsertJob(
                jobDescriptor,
                `${msg}: ${
                    e instanceof Error
                        ? e.message
                        : "Unknown error happened. This is probably a bug."
                }`,
                JobState.FAILED
            ),
            TE.chainW((job) => {
                return this.jobRepository.rescheduleFailedJob(job);
            })
        )();
        return e;
    }

    private cancelJob(job: JobDescriptor): TE.TaskEither<JobUpsertError, Job> {
        const msg = `Job was canceled because no loader with key ${schemaInfoToString(
            job.info
        )} was found.`;
        return this.upsertJob(job, msg, JobState.CANCELED);
    }

    private scheduleJob(
        job: JobDescriptor
    ): TE.TaskEither<JobUpsertError, Job> {
        const msg = "Scheduling new job for execution.";
        return this.upsertJob(job, msg, JobState.SCHEDULED);
    }

    private upsertJob(
        jobDescriptor: JobDescriptor,
        note: string,
        state: JobState
    ): TE.TaskEither<JobUpsertError, Job> {
        const job = { ...jobDescriptor, state };
        return pipe(
            this.jobRepository.upsertJob(job, note),
            TE.mapLeft((e) => {
                this.logger.warn(`Job upsert failed:`, e);
                return new JobUpsertError(job, e);
            })
        );
    }
}

export class JobSchedulerStub implements JobScheduler {
    starts = [] as boolean[];
    stops = [] as boolean[];
    loaders = [] as DataLoader<unknown>[];
    removedLoaders = [] as string[];
    scheduledJobs = [] as Job[];

    start(): TE.TaskEither<SchedulerStartupError, void> {
        this.starts.push(true);
        return TE.right(undefined);
    }
    register(
        loader: DataLoader<unknown>
    ): TE.TaskEither<RegistrationError, void> {
        this.loaders.push(loader);
        return TE.right(undefined);
    }
    remove(name: string): E.Either<SchedulerNotRunningError, void> {
        this.removedLoaders.push(name);
        return E.right(undefined);
    }
    schedule(
        jobDescriptor: JobDescriptor
    ): TE.TaskEither<SchedulingError, Job> {
        const job = { ...jobDescriptor, state: JobState.SCHEDULED };
        this.scheduledJobs.push(job);
        return TE.right(job);
    }
    stop(): void {
        this.stops.push(true);
    }
}

export const createJobSchedulerStub = () => new JobSchedulerStub();
