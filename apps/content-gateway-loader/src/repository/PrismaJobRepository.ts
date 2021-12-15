/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    JobSchedule,
    JobState, Prisma,
    PrismaClient, ScheduleMode
} from "@cgl/prisma";
import { createLogger } from "@shared/util-fp";
import { DatabaseError, Job, JobRepository } from "@shared/util-loaders";
import {
    SchemaInfo,
    schemaInfoToString,
    stringToSchemaInfo
} from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";

export const createJobRepository = (prisma: PrismaClient): JobRepository => {
    const logger = createLogger("PrismaJobRepository");

    const jobScheduleToJob = (jobSchedule: JobSchedule): Job => ({
        cursor: jobSchedule.cursor.toString(),
        limit: jobSchedule.limit,
        info: stringToSchemaInfo(jobSchedule.name),
        state: JobState[jobSchedule.state],
        scheduleMode: ScheduleMode[jobSchedule.scheduleMode],
        scheduledAt: jobSchedule.scheduledAt,
        updatedAt: jobSchedule.updatedAt,
        previousScheduledAt: jobSchedule.previousScheduledAt ?? undefined,
        currentFailCount: jobSchedule.currentFailCount,
    });

    const upsertJob = (
        job: Job,
        note: string,
        info: Record<string, unknown> = {}
    ) => {
        const key = schemaInfoToString(job.info);
        logger.info(
            `Updating job ${key} with state ${job.state} and note '${note}'.`
        );
        const state = job.state;
        return pipe(
            TE.tryCatch(
                async () => {
                    const jobSchedule = {
                        name: key,
                        state: state,
                        scheduleMode: job.scheduleMode,
                        cursor: job.cursor,
                        limit: job.limit,
                        previousScheduledAt: job.previousScheduledAt,
                        currentFailCount: job.currentFailCount,
                        scheduledAt: job.scheduledAt,
                        updatedAt: new Date(),
                        log: {
                            create: {
                                state: state,
                                note: note,
                                info: info as Prisma.JsonObject,
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
            TE.map(jobScheduleToJob)
        );
    };

    return {
        findAll: () => {
            return pipe(
                async () => prisma.jobSchedule.findMany(),
                T.map((jobSchedules) => jobSchedules.map(jobScheduleToJob))
            );
        },
        findJob: (info: SchemaInfo) => {
            return pipe(
                TO.tryCatch(async () => {
                    const key = schemaInfoToString(info);
                    return prisma.jobSchedule.findUnique({
                        where: {
                            name: key,
                        },
                    });
                }),
                TO.map((data) => {
                    return data ? jobScheduleToJob(data) : null;
                })
            );
        },
        remove: (name: string) => {
            return pipe(
                TE.tryCatch(
                    async () =>
                        prisma.jobSchedule.delete({
                            where: {
                                name,
                            },
                        }),
                    (err: unknown) => new DatabaseError(err)
                ),
                TE.map(() => undefined)
            );
        },
        removeAll: () => {
            return pipe(
                TE.tryCatch(
                    async () => {
                        return prisma.jobSchedule.deleteMany({});
                    },
                    (err: unknown) => new DatabaseError(err)
                ),
                TE.map(() => undefined)
            );
        },
        upsertJob: upsertJob,
        loadNextJobs: () => {
            return pipe(
                () =>
                    prisma.jobSchedule.findMany({
                        where: {
                            state: JobState.SCHEDULED,
                            scheduledAt: {
                                lte: new Date(),
                            },
                        },
                    }),
                T.map((schedules) => schedules.map(jobScheduleToJob))
            );
        },
    };
};
