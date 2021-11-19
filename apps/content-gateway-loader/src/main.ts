import {
    createContentGatewayClient,
    createRESTAdapter
} from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cgl/prisma";
import { createLoaderRegistry } from "@domain/feature-loaders";
import { createLogger, programError } from "@shared/util-fp";
import { createJobScheduler } from "@shared/util-loaders";
import * as express from "express";
import { createJobRepository } from "./repository/PrismaJobRepository";

const PORT =
    process.env.PORT ||
    process.env.CGL_PORT ||
    programError("You must specify either PORT or CGL_PORT");

const CGA_URL = process.env.CGA_URL || programError("You must specify CGA_URL");

const env = process.env.NODE_ENV;
const isDev = env === "development";
const logger = createLogger("main");

const prisma = new PrismaClient();

const main = async () => {
    if (isDev) {
        await prisma.jobLog.deleteMany({});
        await prisma.jobSchedule.deleteMany({});
    }

    const loaderRegistry = createLoaderRegistry();
    const app = express();

    const clientStub = createContentGatewayClient({
        adapter: createRESTAdapter(CGA_URL),
    });

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

    const server = app.listen(PORT, () => {
        console.log(`Listening at http://localhost:${PORT}`);
    });

    server.on("error", (err) => {
        logger.error(err);
    });

    const scheduler = createJobScheduler(
        createJobRepository(prisma),
        clientStub
    );
    await scheduler.start()();

    for (const loader of loaderRegistry.loaders) {
        await scheduler.register(loader)();
    }
};

main()
    .catch((err) => logger.error(err))
    .finally(() => {
        prisma.$disconnect();
    });
