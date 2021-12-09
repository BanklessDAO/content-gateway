import { createLogger, programError } from "@shared/util-fp";
import { MongoClient } from "mongodb";
import { createApp } from "./app/";

const logger = createLogger("main");

const url =
    process.env.MONGO_CGA_URL ?? programError("You must specify MONGO_CGA_URL");
const dbName =
    process.env.MONGO_CGA_USER ??
    programError("You must specify MONGO_CGA_USER");

const mongoClient = new MongoClient(url, {
    keepAlive: true,
});

async function main() {
    const port =
        process.env.PORT ||
        process.env.CGA_PORT ||
        programError("You must specify either PORT or CGA_PORT");

    await mongoClient.connect();
    await mongoClient.db("admin").command({ ping: 1 });
    logger.info(`Connected to MongoDB at ${url}`);

    const app = await createApp({ dbName, mongoClient });
    const server = app.listen(port, () => {
        console.log(`Listening at http://localhost:${port}`);
    });

    server.on("error", (err) => {
        logger.error(err);
    });
}

main().catch((err) => logger.error(err));
