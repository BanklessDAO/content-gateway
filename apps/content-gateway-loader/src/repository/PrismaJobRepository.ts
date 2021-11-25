import {
    JobSchedule,
    JobState as PrismaJobState,
    PrismaClient
} from "@cgl/prisma";
import { createLogger, programError } from "@shared/util-fp";
import {
    DatabaseError,
    Job,
    JobRepository,
    JobState
} from "@shared/util-loaders";
import { schemaInfoToString, stringToSchemaInfo } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";

const FIRST_FAIL_RETRY_DELAY_MINUTES = 2;

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
                        cursor: job.cursor,
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
                    return new DatabaseError(String(err));
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
                    async () => {
                        return prisma.$transaction(async (tx) => {
                            const staleJobs = await tx.jobSchedule.findMany({
                                where: {
                                    state: {
                                        in: [
                                            PrismaJobState.RUNNING,
                                            PrismaJobState.FAILED,
                                            PrismaJobState.CANCELED,
                                        ],
                                    },
                                },
                            });
                            for (const staleJob of staleJobs) {
                                const updatedJob = {
                                    ...staleJob,
                                    scheduledAt: DateTime.now()
                                        .plus({ minutes: 1 })
                                        .toJSDate(),
                                    state: PrismaJobState.SCHEDULED,
                                    updatedAt: new Date(),
                                    log: {
                                        create: {
                                            state: PrismaJobState.SCHEDULED,
                                            log: "Rescheduling previously stale job.",
                                        },
                                    },
                                };
                                await prisma.jobSchedule.update({
                                    where: {
                                        name: staleJob.name,
                                    },
                                    data: updatedJob,
                                });
                            }
                        });
                    },
                    (err) => {
                        return new DatabaseError(err);
                    }
                ),
                TE.map(() => undefined)
            );
        },
        rescheduleFailedJob: (job: Job) => {
            return pipe(
                TE.tryCatch(
                    async () => {
                        logger.info(`Rescheduling failed job`, job);
                        return prisma.$transaction(async (tx) => {
                            const name = schemaInfoToString(job.info);
                            const jobSchedule =
                                (await tx.jobSchedule.findUnique({
                                    where: { name },
                                })) ??
                                programError(`Couldn't find job ${name}.`);
                            const nextFailCount =
                                (jobSchedule?.currentFailCount ?? 0) + 1;

                            let scheduledAt: Date;
                            let note: string;

                            if (jobSchedule?.currentFailCount === 0) {
                                scheduledAt = DateTime.now()
                                    .plus({
                                        seconds: FIRST_FAIL_RETRY_DELAY_MINUTES,
                                    })
                                    .toJSDate();
                                note = `Job hasn't failed before. New fail count is ${nextFailCount}`;
                                logger.info(note);
                            } else {
                                const previousTime =
                                    jobSchedule?.ranPreviouslyAt ??
                                    programError(
                                        "ranPreviouslyAt should have had a value. This is a bug!"
                                    );
                                const lastTime = jobSchedule.scheduledAt;
                                const diff =
                                    (lastTime.getTime() -
                                        previousTime.getTime()) *
                                    2;
                                scheduledAt = DateTime.now()
                                    .plus({ milliseconds: diff })
                                    .toJSDate();
                                note = `Job failed before (${nextFailCount}), applying exponential backoff. previous time: ${previousTime.toISOString()}, last time: ${lastTime.toISOString()}, diff: ${diff} next time: ${scheduledAt.toISOString()}`;
                                logger.info(note);
                            }
                            await prisma.jobSchedule.update({
                                where: { name },
                                data: {
                                    cursor: jobSchedule.cursor,
                                    limit: jobSchedule.limit,
                                    updatedAt: new Date(),
                                    state: PrismaJobState.SCHEDULED,
                                    ranPreviouslyAt: jobSchedule.scheduledAt,
                                    scheduledAt: scheduledAt,
                                    currentFailCount: nextFailCount,
                                    log: {
                                        create: {
                                            state: PrismaJobState.SCHEDULED,
                                            log: note,
                                        },
                                    },
                                },
                            });
                        });
                    },
                    (err) => {
                        return new DatabaseError(err);
                    }
                ),
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
