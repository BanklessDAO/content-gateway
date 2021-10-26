import { PrismaClient } from "@cgl/prisma";
import * as express from "express";
import { Logger } from "tslog";
import { createScheduler } from "./app";

const programError = (msg: string) => {
    throw new Error(msg);
};

const PORT =
    process.env.PORT ||
    process.env.CGL_PORT ||
    programError("You must specify either PORT or CGL_PORT");

const CGA_URL = process.env.CGA_URL || programError("You must specify CGA_URL");

const logger = new Logger({
    name: "main",
});
const app = express();
const prisma = new PrismaClient();

app.get("/", (req, res) => {
    res.send(
        `More info <a href="https://github.com/BanklessDAO/content-gateway/tree/master/apps/content-gateway-loader">here</a>.`
    );
});

const server = app.listen(PORT, () => {
    console.log(`Listening at http://localhost:${PORT}`);
});

server.on("error", logger.error);

const scheduler = createScheduler(prisma);

scheduler.start();
