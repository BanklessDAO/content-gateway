/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
    createContentGatewayClient,
    createHTTPAdapterV1
} from "@banklessdao/content-gateway-sdk";
import {
    base64Decode,
    createLogger,
    extractRight,
    programError
} from "@banklessdao/util-misc";
import { ContentGatewayUserCodec } from "@domain/feature-gateway";
import { createJobScheduler } from "@shared/util-loaders";
import * as E from "fp-ts/Either";
import { MongoClient } from "mongodb";
import { ToadScheduler } from "toad-scheduler";
import { addCoreLoaders, addMaintenanceJobs, createAPIs } from "./app/";
import { AtlasApiInfo } from "./app/maintenance/jobs/index-handling/IndexCreationJob";
import { createMongoJobRepository } from "./app/repository/MongoJobRepository";

const logger = createLogger("main");

const schemasCollectionName = "schemas";
const usersCollectionName = "users";
const jobsCollectionName = "jobs";

// === env var list ===
// * CG_MONGO_USER      mongo db name
// * CG_MONGO_URL       mongo connection url
// * PORT               port to listen on
// * CG_PORT            same as above
// * NODE_ENV           node env
// * CG_API_URL         the (root) url of the content gateway api
// * CG_API_KEY         content gateway api key to use for requests
// * ROOT_USER          base64 encoded root user

async function main() {
    // === mandatory ===
    const mongoUrl =
        process.env.CG_MONGO_URL ??
        programError("You must specify CG_MONGO_URL");
    const dbName =
        process.env.CG_MONGO_USER ??
        programError("You must specify CG_MONGO_USER");

    const mongoClient = new MongoClient(mongoUrl, {
        keepAlive: true,
    });

    const port =
        process.env.PORT ||
        process.env.CG_PORT ||
        programError("You must specify either PORT or CG_PORT");
    const nodeEnv = process.env.NODE_ENV ?? programError("NODE_ENV not set");
    const apiKey =
        process.env.CG_API_KEY || programError("You must specify CG_API_KEY");
    const apiUrl =
        process.env.CG_API_URL || programError("You must specify CG_API_URL");
    const rootUserRaw =
        process.env.ROOT_USER ?? programError("ROOT_USER not set");
    const rootUserMaybe = ContentGatewayUserCodec.decode(
        JSON.parse(base64Decode(rootUserRaw))
    );
    if (E.isLeft(rootUserMaybe)) {
        programError(`ROOT_USER is invalid`);
    }

    // === atlas ===
    const publicKey = process.env.ATLAS_PUBLIC_KEY;
    const privateKey = process.env.ATLAS_PRIVATE_KEY;
    const projectId = process.env.ATLAS_PROJECT_ID;
    const processId = process.env.ATLAS_PROCESS_ID;
    const atlasOk = privateKey && publicKey && projectId && processId;
    const atlasApiInfo: AtlasApiInfo | undefined = atlasOk
        ? {
              publicKey: publicKey!,
              privateKey: privateKey!,
              projectId: projectId!,
              processId: processId!,
          }
        : undefined;

    // === loaders ===
    const youtubeAPIKey = process.env.YOUTUBE_API_KEY;
    const ghostAPIKey = process.env.GHOST_API_KEY;
    const snapshotSpaces = process.env.SNAPSHOT_SPACES?.split(",");
    const discordBotToken = process.env.DISCORD_BOT_TOKEN;
    const discordChannel = process.env.DISCORD_CHANNEL;

    await mongoClient.connect();
    await mongoClient.db("admin").command({ ping: 1 });
    logger.info(`Connected to MongoDB`);

    const db = mongoClient.db(dbName);
    const toad = new ToadScheduler();

    const jobRepository = await createMongoJobRepository({
        db,
        collName: jobsCollectionName,
    });

    const contentGatewayClient = createContentGatewayClient({
        adapter: createHTTPAdapterV1({
            apiUrl,
            apiKey,
        }),
    });

    const jobScheduler = createJobScheduler({
        toad,
        jobRepository,
        contentGatewayClient,
    });

    const app = await createAPIs({
        db,
        nodeEnv,
        jobRepository,
        jobScheduler,
        jobsCollectionName,
        schemasCollectionName,
        usersCollectionName,
        rootUser: extractRight(rootUserMaybe),
    });

    const server = app.listen(port, () => {
        console.log(`Listening at http://localhost:${port}`);
    });

    server.on("error", (err) => {
        logger.error(err);
    });

    addCoreLoaders({
        app,
        jobScheduler,
        apiUrl,
        apiKey,
        ghostAPIKey,
        youtubeAPIKey,
        snapshotSpaces,
        discordBotToken,
        discordChannel,
    });

    addMaintenanceJobs({
        atlasApiInfo,
        db,
        toad,
    });
}

main().catch((err) => logger.error(err));
