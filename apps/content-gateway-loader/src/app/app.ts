import {
    createContentGatewayClient,
    createRESTAdapter
} from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cgl/prisma";
import { createLoaderRegistry } from "@domain/feature-loaders";
import { createLogger, programError } from "@shared/util-fp";
import { createJobScheduler } from "@shared/util-loaders";
import * as express from "express";
import { join } from "path";
import { createJobRepository } from "../repository/PrismaJobRepository";

export const createApp = async (prisma: PrismaClient) => {
    const CGA_URL =
        process.env.CGA_URL || programError("You must specify CGA_URL");

    const env = process.env.NODE_ENV ?? programError("NODE_ENV not set");
    const isProd = env === "production";
    const resetDb = process.env.RESET_DB === "true";
    const logger = createLogger("ContentGatewayLoaderApp");
    const addFrontend = process.env.ADD_FRONTEND === "true";

    if (resetDb) {
        logger.info("Database reset requested. Resetting...")
        await prisma.jobLog.deleteMany({});
        await prisma.jobSchedule.deleteMany({});
    }

    logger.info(`Running in ${env} mode`);

    const loaderRegistry = createLoaderRegistry();
    const jobRepository = createJobRepository(prisma);
    const adapter = createRESTAdapter(CGA_URL);

    const contentGatewayClient = createContentGatewayClient({
        adapter: adapter,
    });

    const scheduler = createJobScheduler({
        jobRepository, contentGatewayClient
    });

    await scheduler.start()();

    for (const loader of loaderRegistry.loaders) {
        await scheduler.register(loader)();
    }

    const app = express();

    app.get("/", (req, res) => {
        res.send(
            `More info <a href="https://github.com/BanklessDAO/content-gateway/tree/master/apps/content-gateway-loader">here</a>.`
        );
    });

    app.get("/jobs", async (req, res) => {
        const jobs = await prisma.jobSchedule.findMany({});
        const result = jobs.map((job) => {
            return {
                name: job.name,
                state: job.state,
                nextRun: job.scheduledAt,
            };
        });
        res.send(result);
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
