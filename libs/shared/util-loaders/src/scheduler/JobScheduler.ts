import { ContentGatewayClient } from "@banklessdao/content-gateway-sdk";
import { ProgramError } from "@banklessdao/util-data";
import { createLogger, programError } from "@banklessdao/util-misc";
import { SchemaInfo, schemaInfoToString } from "@banklessdao/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import { DatabaseError, JobDescriptor, RemoveError } from ".";
import { LoadingResult } from "..";
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

const FIRST_FAIL_RETRY_DELAY_MINUTES = 2;

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
    remove: (name: string) => TE.TaskEither<RemoveError, void>;
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
    toad: ToadScheduler;
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
    private toad: ToadScheduler;
    private jobRepository: JobRepository;

    constructor(deps: Deps) {
        this.jobRepository = deps.jobRepository;
        this.client = deps.contentGatewayClient;
        this.toad = deps.toad;
    }

    start(): TE.TaskEither<SchedulerStartupError, void> {
        if (this.running) {
            return TE.right(undefined);
        }
        this.logger.info("Starting job scheduler.");
        this.running = true;
        return TE.tryCatch(
            async () => {
                const task = new AsyncTask(
                    "Execute Jobs",
                    () => {
                        return this.executeScheduledJobs();
                    },
                    (err) => {
                        this.logger.info("Job execution failed", err);
                    }
                );
                this.toad.addSimpleIntervalJob(
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
                jobs: {
                    findAll: () => {
                        return this.jobRepository.findAll();
                    },
                    findJob: (info: SchemaInfo) => {
                        return this.jobRepository.findJob(info);
                    },
                    register: (loader: DataLoader<unknown>) => {
                        return this.register(loader);
                    },
                    schedule: (jobDescriptor: JobDescriptor) => {
                        return this.schedule(jobDescriptor);
                    },
                },
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
        return pipe(
            this.jobRepository.findJob(jobDescriptor.info),
            TE.fromTaskOption(
                () =>
                    new DatabaseError(
                        "This shouldn't have happened. This is a bug."
                    )
            ),
            TE.chainW((maybeJob) => {
                let job: Job;
                if (maybeJob) {
                    job = {
                        ...maybeJob,
                        ...jobDescriptor,
                        state: JobState.SCHEDULED,
                        updatedAt: new Date(),
                    };
                } else {
                    job = {
                        ...jobDescriptor,
                        state: JobState.SCHEDULED,
                        previousScheduledAt: undefined,
                        currentFailCount: 0,
                        updatedAt: new Date(),
                    };
                }
                if (!this.loaders.has(key)) {
                    return this.cancelJob(job);
                }
                const msg = "Scheduling new job for execution.";
                return this.upsertJob(job, msg, {});
            })
        );
    }

    stop() {
        if (!this.running) {
            return;
        }
        this.logger.info("Stopping job scheduler.");
        this.running = false;
        this.toad.stop();
    }

    remove(name: string): TE.TaskEither<RemoveError, void> {
        if (!this.running) {
            return TE.left(new SchedulerNotRunningError());
        }
        if (this.loaders.has(name)) {
            // TODO: we should also remove the job from the job repository
            this.loaders.delete(name);
        }
        return this.jobRepository.remove(name);
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
        const key = schemaInfoToString(job.info);
        return pipe(
            TE.Do,
            TE.bind("runningJob", () =>
                this.jobRepository.upsertJob(
                    {
                        ...job,
                        state: JobState.RUNNING,
                    },
                    "Starting job.",
                    {}
                )
            ),
            TE.bindW("loader", ({ runningJob }) =>
                pipe(
                    O.fromNullable(this.loaders.get(key)),
                    TE.fromOption(() => {
                        this.cancelJob(runningJob)();
                        return new NoLoaderForJobError(runningJob);
                    })
                )
            ),
            TE.bind("loadingResult", ({ loader, runningJob }) =>
                loader.load({
                    limit: runningJob.limit,
                    cursor: runningJob.cursor,
                })
            ),
            TE.bind("nextJob", ({ loader, loadingResult, runningJob }) =>
                loader.save({
                    currentJob: runningJob,
                    client: this.client,
                    jobs: {
                        findAll: () => {
                            return this.jobRepository.findAll();
                        },
                        findJob: (info: SchemaInfo) => {
                            return this.jobRepository.findJob(info);
                        },
                        register: (loader: DataLoader<unknown>) => {
                            return this.register(loader);
                        },
                        schedule: (jobDescriptor: JobDescriptor) => {
                            return this.schedule(jobDescriptor);
                        },
                    },
                    loadingResult: loadingResult,
                })
            ),
            TE.mapLeft((e) => {
                return this.failJob(job, e);
            }),
            TE.bindW("completedJob", ({ loadingResult, runningJob }) => {
                return this.completeJob(runningJob, loadingResult);
            }),
            TE.map(({ nextJob, completedJob }) => {
                if (nextJob) {
                    this.logger.info(
                        "A next job was returned, scheduling...",
                        nextJob
                    );
                    this.rescheduleJob({ ...completedJob, ...nextJob }, {})();
                }
                return undefined;
            })
        );
    }

    private rescheduleJob(
        previousJob: Job,
        info: Record<string, unknown> = {}
    ): TE.TaskEither<JobUpsertError, Job> {
        const msg = `Rescheduling job.`;
        return this.upsertJob(
            {
                ...previousJob,
                state: JobState.SCHEDULED,
                previousScheduledAt: previousJob.scheduledAt,
                currentFailCount: previousJob.currentFailCount,
                updatedAt: new Date(),
            },
            msg,
            info
        );
    }

    private failJob<E>(job: Job, e: E, info: Record<string, unknown> = {}) {
        const msg = `Loader ${schemaInfoToString(job.info)} failed`;
        this.logger.warn(msg, e);
        pipe(
            this.upsertJob(
                {
                    ...job,
                    state: JobState.FAILED,
                    currentFailCount: job.currentFailCount + 1,
                },
                `${msg}: ${
                    e instanceof Error
                        ? e.message
                        : "Unknown error happened. This is probably a bug."
                }`,
                info
            ),
            TE.chainW((jobSchedule) => {
                let nextScheduledAt: Date;
                let note: string;
                let extraInfo: Record<string, unknown>;
                if (jobSchedule?.currentFailCount === 1) {
                    nextScheduledAt = DateTime.now()
                        .plus({
                            minutes: FIRST_FAIL_RETRY_DELAY_MINUTES,
                        })
                        .toJSDate();
                    note = `Job hasn't failed before. New fail count is ${jobSchedule.currentFailCount}`;
                    this.logger.info(note);
                    extraInfo = {};
                } else {
                    const previousTime =
                        jobSchedule?.previousScheduledAt ??
                        programError(
                            "previousScheduledAt should have had a value. This is a bug!"
                        );
                    const lastTime = jobSchedule.scheduledAt;
                    const diff =
                        (lastTime.getTime() - previousTime.getTime()) * 2;
                    nextScheduledAt = DateTime.now()
                        .plus({ milliseconds: diff })
                        .toJSDate();
                    note = `Job failed before (${
                        jobSchedule.currentFailCount
                    }), applying exponential backoff. previous time: ${previousTime.toISOString()}, last time: ${lastTime.toISOString()}, diff: ${diff} next time: ${nextScheduledAt.toISOString()}`;
                    this.logger.info(note);
                    extraInfo = {
                        exponentialBackoff: true,
                        previouslyScheduledAt: previousTime.getTime(),
                        lastScheduledAt: lastTime.getTime(),
                        diff: diff,
                        nextScheduledAt: nextScheduledAt.getTime(),
                        failCount: jobSchedule.currentFailCount,
                    };
                }
                return this.rescheduleJob(
                    {
                        ...jobSchedule,
                        scheduledAt: nextScheduledAt,
                    },
                    extraInfo
                );
            })
        )();
        return e;
    }

    private completeJob(
        job: Job,
        loadingResult: LoadingResult<unknown>
    ): TE.TaskEither<JobUpsertError, Job> {
        let msg = `Job ${schemaInfoToString(job.info)} completed successfully.`;
        if (job.currentFailCount > 0) {
            msg = `${msg} Clearing fail count.`;
        }
        return this.upsertJob(
            { ...job, state: JobState.COMPLETED, currentFailCount: 0 },
            msg,
            {
                recordCount: loadingResult.data.length,
            }
        );
    }

    private cancelJob(
        job: Job,
        info: Record<string, unknown> = {}
    ): TE.TaskEither<JobUpsertError, Job> {
        const msg = `Job was canceled because no loader with key ${schemaInfoToString(
            job.info
        )} was found.`;
        return this.upsertJob(
            {
                ...job,
                state: JobState.CANCELED,
            },
            msg,
            info
        );
    }

    private upsertJob(
        job: Job,
        note: string,
        info: Record<string, unknown> = {}
    ): TE.TaskEither<JobUpsertError, Job> {
        return pipe(
            this.jobRepository.upsertJob(
                {
                    ...job,
                    updatedAt: new Date(),
                },
                note,
                {
                    scheduledAt: job.scheduledAt,
                    limit: job.limit,
                    cursor: job.cursor,
                    ...info,
                }
            ),
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
    remove(name: string): TE.TaskEither<RemoveError, void> {
        this.removedLoaders.push(name);
        return TE.right(undefined);
    }
    schedule(
        jobDescriptor: JobDescriptor
    ): TE.TaskEither<SchedulingError, Job> {
        const job = {
            ...jobDescriptor,
            state: JobState.SCHEDULED,
            previousScheduledAt: undefined,
            currentFailCount: 0,
            updatedAt: new Date(),
        };
        this.scheduledJobs.push(job);
        return TE.right(job);
    }
    stop(): void {
        this.stops.push(true);
    }
}

export const createJobSchedulerStub = () => new JobSchedulerStub();
