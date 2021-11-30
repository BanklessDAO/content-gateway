import {
    createContentGatewayClient,
    createRESTAdapter,
} from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cgl/prisma";
import { createLoaderRegistry } from "@domain/feature-loaders";
import { createLogger, programError } from "@shared/util-fp";
import { createJobScheduler, ScheduleMode } from "@shared/util-loaders";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { join } from "path";
import { createJobRepository } from "../repository/PrismaJobRepository";
import * as bodyParser from "body-parser";

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
    const adapter = createRESTAdapter(CGA_URL);

    const contentGatewayClient = createContentGatewayClient({
        adapter: adapter,
    });

    const scheduler = createJobScheduler({
        jobRepository,
        contentGatewayClient,
    });

    await scheduler.start()();

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

    // TODO: move these to the repo
    app.get("/api/rest/jobs", async (_, res) => {
        const jobs = await prisma.jobSchedule.findMany({});
        res.send(
            jobs.map((job) => {
                return {
                    name: job.name,
                    state: job.state,
                    scheduleMode: job.scheduleMode,
                    cursor: job.cursor,
                    limit: job.limit,
                    currentFailCount: job.currentFailCount,
                    scheduledAt: job.scheduledAt.getTime(),
                    previousScheduledAt: job.previousScheduledAt?.getTime(),
                    updatedAt: job.updatedAt.getTime(),
                };
            })
        );
    });

    app.post("/api/rest/jobs/", (req, res) => {
        console.log(req.body);
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
                    scheduler
                        .schedule({
                            info: params.info,
                            scheduledAt: new Date(params.scheduledAt),
                            scheduleMode: params.scheduleMode,
                            cursor: params.cursor,
                            limit: params.limit,
                        })()
                        .then(() => {
                            res.send("OK");
                        })
                        .catch((e) => {
                            res.status(500).send(e);
                        });
                }
            )
        );
    });

    app.get("/api/rest/jobs/:name", async (req, res) => {
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
