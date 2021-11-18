import {
    JobSchedule,
    JobState as PrismaJobState,
    PrismaClient
} from "@cgl/prisma";
import { createLogger } from "@shared/util-fp";
import { Job, JobRepository, JobState } from "@shared/util-loaders";
import { schemaInfoToString, stringToSchemaInfo } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";

export const createJobRepository = (prisma: PrismaClient): JobRepository => {
    const logger = createLogger("PrismaJobRepository");

    const jobScheduleToJobDescriptor = (jobSchedule: JobSchedule): Job => ({
        cursor: jobSchedule.cursor.toString(),
        limit: jobSchedule.limit,
        info: stringToSchemaInfo(jobSchedule.name),
        scheduledAt: jobSchedule.scheduledAt,
        state: JobState[jobSchedule.state],
    });

    const upsertJob = (job: Job, note: string) => {
        const key = schemaInfoToString(job.info);
        logger.info(
            `Updating job ${key} with state ${job.state} and note '${note}'.`
        );
        const state = PrismaJobState[job.state];
        return pipe(
            TE.tryCatch(
                async () => {
                    const jobSchedule = {
                        name: key,
                        cursor: BigInt(job.cursor),
                        limit: job.limit,
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
                    return prisma.jobSchedule.upsert({
                        where: {
                            name: key,
                        },
                        create: jobSchedule,
                        update: jobSchedule,
                    });
                },
                (err: unknown) => {
                    logger.warn(
                        `Couldn't update job ${key} to state ${state}. Cause:`,
                        err
                    );
                    return new Error(String(err));
                }
            ),
            TE.map(jobScheduleToJobDescriptor)
        );
    };

    return {
        upsertJob: upsertJob,
        cleanStaleJobs: () => {
            return pipe(
                TE.tryCatch(
                    () => {
                        return prisma.jobSchedule.findMany({
                            where: {
                                state: PrismaJobState.RUNNING,
                            },
                        });
                    },
                    () => {
                        return new Error("Not implemented");
                    }
                ),
                TE.chain((staleJobs) => {
                    return pipe(
                        staleJobs.map((job) =>
                            upsertJob(
                                {
                                    ...jobScheduleToJobDescriptor(job),
                                    state: JobState.FAILED,
                                },
                                `Job ${job.name} was in RUNNING state after application started. Setting state to FAILED.`
                            )
                        ),
                        TE.sequenceArray
                    );
                }),
                TE.map(() => undefined)
            );
        },

        loadNextJobs: () => {
            return pipe(
                () =>
                    prisma.jobSchedule.findMany({
                        where: {
                            state: PrismaJobState.SCHEDULED,
                            scheduledAt: {
                                lte: new Date(),
                            },
                        },
                    }),
                T.map((schedules) => schedules.map(jobScheduleToJobDescriptor))
            );
        },
    };
};
