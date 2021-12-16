import {
    createContentGatewayClientV1,
    createHTTPAdapterV1
} from "@banklessdao/content-gateway-sdk";
import { PrismaClient } from "@cgl/prisma";
import { createLoaderRegistry } from "@domain/feature-loaders";
import { createLogger, programError } from "@banklessdao/util-misc";
import {
    createJobScheduler,
    DEFAULT_CURSOR,
    DEFAULT_LIMIT,
    Job,
    ScheduleMode
} from "@shared/util-loaders";
import { schemaInfoToString } from "@banklessdao/util-schema";
import * as bodyParser from "body-parser";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { join } from "path";
import { createJobRepository } from "../repository/PrismaJobRepository";

export const createApp = async (prisma: PrismaClient) => {
    const CGA_URL =
        process.env.CGA_URL || programError("You must specify CGA_URL");
    const YOUTUBE_API_KEY =
        process.env.YOUTUBE_API_KEY ||
        programError("You must specify YOUTUBE_API_KEY");
    const GHOST_API_KEY =
        process.env.GHOST_API_KEY ||
        programError("You must specify GHOST_API_KEY");
    const env =
        process.env.NODE_ENV ?? programError("You must specify NODE_ENV");

    const isProd = env === "production";
    const resetDb = process.env.RESET_DB === "true";
    const logger = createLogger("ContentGatewayLoaderApp");
    const addFrontend = process.env.ADD_FRONTEND === "true";

    if (resetDb) {
        logger.info("Database reset requested. Resetting...");
        await prisma.jobLog.deleteMany({});
        await prisma.jobSchedule.deleteMany({});
    }

    logger.info(`Running in ${env} mode`);

    const loaderRegistry = createLoaderRegistry({
        ghostApiKey: GHOST_API_KEY,
        youtubeApiKey: YOUTUBE_API_KEY,
    });
    const jobRepository = createJobRepository(prisma);
    const adapter = createHTTPAdapterV1(CGA_URL);

    const contentGatewayClient = createContentGatewayClientV1({
        apiKey: "",
        adapter: adapter,
    });

    const scheduler = createJobScheduler({
        jobRepository,
        contentGatewayClient,
    });

    await pipe(
        scheduler.start(),
        TE.mapLeft((err) => {
            logger.error("Starting the Job scheduler failed", err);
            return err;
        })
    )();

    for (const loader of loaderRegistry.loaders) {
        await scheduler.register(loader)();
    }

    const app = express();

    app.use(bodyParser.json());

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

    // TODO: move these to the repo
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
                        scheduler.schedule({
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

    app.get("/api/v1/rest/jobs/reset", (req, res) => {
        return pipe(
            jobRepository.findAll(),
            TE.fromTask,
            TE.chainW((jobs) => {
                return pipe(
                    jobs.map((job) => {
                        return scheduler.schedule({
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
                (jobs) => async () => {
                    res.send(jobs.map(mapJobToJson));
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
                    prisma.jobSchedule
                        .findUnique({
                            where: { name: params.name },
                            include: {
                                log: {
                                    orderBy: {
                                        createdAt: "desc",
                                    },
                                    take: 50,
                                },
                            },
                        })
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
                                    logs: job.log.map((log) => ({
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
                            scheduler.schedule({
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

    const clientBuildPath = join(
        __dirname,
        "../content-gateway-loader-frontend"
    );
    if (addFrontend || isProd) {
        app.use(express.static(clientBuildPath));
        app.get("*", (_, response) => {
            response.sendFile(join(clientBuildPath, "index.html"));
        });
    }

    return app;
};
