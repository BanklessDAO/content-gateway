/* eslint-disable @typescript-eslint/no-explicit-any */
import { schemaInfoToString } from "@banklessdao/util-schema";
import {
    DEFAULT_CURSOR,
    DEFAULT_LIMIT,
    Job,
    JobRepository,
    JobScheduler,
    ScheduleMode,
} from "@shared/util-loaders";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { Db } from "mongodb";
import { MongoJob } from "../../..";

type LoaderAPIParams = {
    db: Db;
    app: express.Application;
    jobsCollectionName: string;
    jobRepository: JobRepository;
    jobScheduler: JobScheduler;
};

export const addLoaderAPIV1 = async ({
    db,
    app,
    jobsCollectionName,
    jobRepository,
    jobScheduler,
}: LoaderAPIParams) => {
    const jobs = db.collection<MongoJob>(jobsCollectionName);
    const NameParam = t.strict({
        name: t.string,
    });

    const JobDescriptorParam = t.strict({
        info: t.strict({
            namespace: withMessage(
                t.string,
                () => "Namespace must be a string"
            ),
            name: withMessage(t.string, () => "Name must be a string"),
            version: withMessage(t.string, () => "Version must be a string"),
        }),
        scheduledAt: withMessage(
            t.number,
            () => "ScheduledAt must be a number"
        ),
        scheduleMode: withMessage(
            t.union([
                t.literal(ScheduleMode.BACKFILL),
                t.literal(ScheduleMode.INCREMENTAL),
            ]),
            () => "ScheduleMode must be either BACKFILL or INCREMENTAL"
        ),
        cursor: withMessage(t.string, () => "Cursor must be a string"),
        limit: withMessage(t.number, () => "Limit must be a number"),
    });

    const mapJobToJson = (job: Job) => ({
        name: schemaInfoToString(job.info),
        state: job.state,
        scheduleMode: job.scheduleMode,
        cursor: job.cursor,
        limit: job.limit,
        currentFailCount: job.currentFailCount,
        scheduledAt: job.scheduledAt.getTime(),
        previousScheduledAt: job.previousScheduledAt?.getTime(),
        updatedAt: job.updatedAt.getTime(),
    });

    app.get("/api/v1/rest/jobs", async (_, res) => {
        const jobs = await jobRepository.findAll()();
        res.send(
            jobs.map((job) => {
                return mapJobToJson(job);
            })
        );
    });

    app.post("/api/v1/rest/jobs/", (req, res) => {
        pipe(
            JobDescriptorParam.decode(req.body),
            E.fold(
                (errors) => {
                    res.status(400).send(
                        errors.map(
                            (e) => `${e.value} was invalid: ${e.message}`
                        )
                    );
                },
                (params) => {
                    return pipe(
                        jobScheduler.schedule({
                            info: params.info,
                            scheduledAt: new Date(params.scheduledAt),
                            scheduleMode: params.scheduleMode,
                            cursor: params.cursor,
                            limit: params.limit,
                        }),
                        TE.fold(
                            (e) => async () => {
                                res.status(500).send(e);
                            },
                            (job) => async () => {
                                res.send(mapJobToJson(job));
                            }
                        )
                    )();
                }
            )
        );
    });

    app.get("/api/v1/rest/jobs/reset", (_, res) => {
        return pipe(
            jobRepository.findAll(),
            TE.fromTask,
            TE.chainW((result) => {
                return pipe(
                    result.map((job) => {
                        return jobScheduler.schedule({
                            info: job.info,
                            scheduledAt: new Date(),
                            scheduleMode: ScheduleMode.BACKFILL,
                            cursor: DEFAULT_CURSOR,
                            limit: DEFAULT_LIMIT,
                        });
                    }),
                    TE.sequenceArray
                );
            }),
            TE.fold(
                (e) => async () => {
                    res.status(500).send(e);
                },
                (result) => async () => {
                    res.send(result.map(mapJobToJson));
                }
            )
        )();
    });

    app.get("/api/v1/rest/jobs/:name", async (req, res) => {
        pipe(
            NameParam.decode(req.params),
            E.fold(
                (errors) => {
                    res.status(400).send(errors);
                },
                (params) => {
                    jobs.findOne({ name: params.name })
                        .then((job) => {
                            if (!job) {
                                res.status(404).send("Not found");
                            } else {
                                res.send({
                                    name: job.name,
                                    state: job.state,
                                    scheduleMode: job.scheduleMode,
                                    cursor: job.cursor,
                                    limit: job.limit,
                                    currentFailCount: job.currentFailCount,
                                    previousScheduledAt:
                                        job.previousScheduledAt?.getTime(),
                                    scheduledAt: job.scheduledAt.getTime(),
                                    updatedAt: job.updatedAt.getTime(),
                                    logs: job.logs.map((log) => ({
                                        note: log.note,
                                        state: log.state,
                                        info: log.info,
                                        createdAt: log.createdAt.getTime(),
                                    })),
                                });
                            }
                        })
                        .catch((e) => {
                            res.status(500).send(e);
                        });
                }
            )
        );
    });

    app.get("/api/v1/rest/jobs/:name/reset", async (req, res) => {
        pipe(
            NameParam.decode(req.params),
            E.fold(
                (errors) => {
                    res.status(400).send(errors);
                },
                (params) => {
                    const parts = params.name.split(".");
                    return pipe(
                        jobRepository.findJob({
                            namespace: parts[0],
                            name: parts[1],
                            version: parts[2],
                        }),
                        TO.chain(TO.fromNullable),
                        TE.fromTaskOption(() => new Error("Not found")),
                        TE.chainW((job) =>
                            jobScheduler.schedule({
                                info: job.info,
                                scheduledAt: new Date(),
                                scheduleMode: ScheduleMode.BACKFILL,
                                cursor: DEFAULT_CURSOR,
                                limit: DEFAULT_LIMIT,
                            })
                        ),
                        TE.fold(
                            (e) => async () => {
                                res.status(500).send(e);
                            },
                            (job) => async () => {
                                res.send(mapJobToJson(job));
                            }
                        )
                    )();
                }
            )
        );
    });
};
