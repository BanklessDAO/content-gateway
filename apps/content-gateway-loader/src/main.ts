import { createStubClient } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cgl/prisma";
import * as express from "express";
import { Logger } from "tslog";
import { createJobScheduler, JobScheduler } from "./app";
import { exampleLoader } from "./app/loaders/ExampleLoader";
import { banklessAcademyLoader } from "./app/loaders/BanklessAcademyLoader";

const programError = (msg: string) => {
    throw new Error(msg);
};
const PORT =
    process.env.PORT ||
    process.env.CGL_PORT ||
    programError("You must specify either PORT or CGL_PORT");

const CGA_URL = process.env.CGA_URL || programError("You must specify CGA_URL");

/**
 * 📗 Note for developers: this is where you should register your loaders.
 */
const registerLoaders = (scheduler: JobScheduler) => {
    scheduler.register(exampleLoader);
    scheduler.register(banklessAcademyLoader);
};

const main = async () => {
    const logger = new Logger({
        name: "main",
    });
    const app = express();

    const prisma = new PrismaClient();
    const stubClient = createStubClient();

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

    const scheduler = createJobScheduler(prisma, stubClient.client);
    await scheduler.start();

    registerLoaders(scheduler);
};
main();
