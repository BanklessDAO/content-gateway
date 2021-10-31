import {
    createClient,
    createRESTAdapter,
} from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cgl/prisma";
import * as express from "express";
import { Logger } from "tslog";
import { createJobScheduler, JobScheduler } from "./app";
import { banklessAcademyLoader } from "./app/loaders/BanklessAcademyLoader";
import { bountyBoardLoader } from "./app/loaders/BountyBoardLoader"
import { banklessTokenLoader } from "./app/loaders/banklessToken/BanklessTokenLoader";
import { exampleTimestampLoader } from "./app/loaders/example/ExampleTimestampLoader";
import { exampleUUIDLoader } from "./app/loaders/example/ExampleUUIDLoader";
import { poapLoader } from "./app/loaders/poap/POAPLoader";

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
    scheduler.register(banklessAcademyLoader);
    scheduler.register(bountyBoardLoader);
    scheduler.register(banklessTokenLoader);
    scheduler.register(poapLoader);
};

const main = async () => {
    const logger = new Logger({
        name: "main",
    });
    const app = express();

    const prisma = new PrismaClient();
    const clientStub = createClient({
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

    const scheduler = createJobScheduler(prisma, clientStub);
    await scheduler.start();

    registerLoaders(scheduler);
};
main();
