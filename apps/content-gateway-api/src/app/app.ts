/* eslint-disable @typescript-eslint/no-explicit-any */
import { createLogger } from "@banklessdao/util-misc";
import {
    ContentGateway,
    ContentGatewayUser,
    createContentGateway,
    DataRepository,
    UserRepository,
} from "@domain/feature-gateway";
import { createLoaderRegistry } from "@domain/feature-loaders";
import { JobRepository, JobScheduler } from "@shared/util-loaders";
import * as bodyParser from "body-parser";
import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as g from "graphql";
import { Collection, Db, ObjectId } from "mongodb";
import { ToadScheduler } from "toad-scheduler";
import {
    authorization,
    createGraphQLAPIV1,
    createMongoUserRepository,
    ObservableSchemaRepository,
    toObservableSchemaRepository,
} from ".";
import { createMongoDataRepository, createMongoSchemaRepository } from "./";
import { liveLoaders } from "./live-loaders";
import { LiveLoader } from "./live-loaders/LiveLoader";
import { AtlasApiInfo } from "./maintenance/jobs/index-handling/IndexCreationJob";
import { createJobs, JobConfig } from "./maintenance/jobs/jobs";
import { MongoUser } from "./repository/mongo/MongoUser";
import { createMongoMaintainer } from "./repository/MongoMaintainer";
import { createContentGatewayAPIV1 } from "./service";
import { addLoaderAPIV1 } from "./service/v1/loader/LoaderAPI";

export type ApplicationContext = {
    app: express.Application;
    schemaRepository: ObservableSchemaRepository;
    userRepository: UserRepository;
    dataRepository: DataRepository;
    contentGateway: ContentGateway;
};

type APIParams = {
    nodeEnv: string;
    db: Db;
    jobRepository: JobRepository;
    jobScheduler: JobScheduler;
    jobsCollectionName: string;
    schemasCollectionName: string;
    usersCollectionName: string;
    rootUser: ContentGatewayUser;
};

const logger = createLogger("ContentGateway");

export const createAPIs = async (params: APIParams) => {
    logger.info(`Running in ${params.nodeEnv} mode`);
    const {
        db,
        jobsCollectionName,
        jobRepository,
        jobScheduler,
        rootUser,
        schemasCollectionName,
        usersCollectionName,
    } = params;
    const app = express();
    app.use(bodyParser.json({ limit: "50mb" }));

    await addCgApiV1({
        db,
        app,
        rootUser,
        schemasCollectionName,
        usersCollectionName,
    });

    await addLoaderAPIV1({
        db,
        app,
        jobsCollectionName,
        jobRepository,
        jobScheduler,
    });

    return app;
};

type CoreLoaderAppParams = {
    app: express.Application;
    jobScheduler: JobScheduler;
    apiUrl: string;
    apiKey: string;
    // optional
    ghostAPIKey?: string;
    youtubeAPIKey?: string;
    snapshotSpaces?: string[];
    discordBotToken?: string;
    discordChannel?: string;
};

export const addCoreLoaders = async (appParams: CoreLoaderAppParams) => {
    const {
        ghostAPIKey,
        youtubeAPIKey,
        snapshotSpaces,
        discordBotToken,
        discordChannel,
        jobScheduler,
    } = appParams;

    const loaderRegistry = createLoaderRegistry({
        ghostApiKey: ghostAPIKey,
        youtubeApiKey: youtubeAPIKey,
        snapshotSpaces,
        discordBotToken,
        discordChannel,
    });

    await pipe(
        jobScheduler.start(),
        TE.mapLeft((err) => {
            logger.error("Starting the Job scheduler failed", err);
            return err;
        })
    )();

    for (const loader of loaderRegistry.loaders) {
        await jobScheduler.register(loader)();
    }
};

type CgApiParams = {
    db: Db;
    app: express.Application;
    usersCollectionName: string;
    schemasCollectionName: string;
    rootUser: ContentGatewayUser;
};

const addCgApiV1 = async ({
    db,
    usersCollectionName,
    schemasCollectionName,
    app,
    rootUser,
}: CgApiParams) => {
    const users = db.collection<MongoUser>(usersCollectionName);

    const schemaRepository = toObservableSchemaRepository(
        await createMongoSchemaRepository({
            db,
            schemasCollectionName,
            usersCollectionName,
        })
    );

    const dataRepository = createMongoDataRepository({
        db,
        schemaRepository,
    });

    const userRepository = await createMongoUserRepository({
        db,
        usersCollectionName,
    });

    const contentGateway = createContentGateway({
        dataRepository,
        userRepository,
        schemaRepository,
        authorization,
    });

    const context: ApplicationContext = {
        app,
        schemaRepository,
        dataRepository,
        userRepository,
        contentGateway,
    };

    await ensureRootUserExists(rootUser, users);

    app.use("/api/v1/rest/", await createContentGatewayAPIV1(context));
    app.use("/api/v1/graphql/", await createGraphQLAPIV1(context));
    app.use(
        "/api/v1/graphql-live",
        createGraphQLLiveService({
            liveLoaders: liveLoaders,
        })
    );
};

type MaintenanceJobsParams = {
    atlasApiInfo?: AtlasApiInfo;
    db: Db;
    toad: ToadScheduler;
};

export const addMaintenanceJobs = ({
    atlasApiInfo,
    db,
    toad,
}: MaintenanceJobsParams) => {
    if (atlasApiInfo) {
        logger.info(
            "Atlas information was present, creating index maintenance job"
        );
        const maintenanceJobConfig: JobConfig = {
            atlasApiInfo: atlasApiInfo,
        };
        const maintenanceJobs = createJobs(maintenanceJobConfig, db);
        createMongoMaintainer(maintenanceJobs, toad);
    } else {
        logger.info(
            "Atlas information was not present, skipping index maintenance job"
        );
    }
};

const ensureRootUserExists = async (
    rootUser: ContentGatewayUser,
    users: Collection<MongoUser>
) => {
    const existingUser = await users.findOne({
        _id: new ObjectId(rootUser.id),
    });
    if (!existingUser) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...toInsert } = rootUser;
        await users.insertOne({
            ...toInsert,
            _id: new ObjectId(rootUser.id),
        });
    }
};

export const createGraphQLLiveService = (deps: {
    readonly liveLoaders: LiveLoader<any, any>[];
}) => {
    const fields = deps.liveLoaders
        .map((loader) => loader.configure())
        .reduce((acc, next) => {
            return { ...acc, ...next };
        }, {} as g.GraphQLFieldConfigMap<string, unknown>);
    return graphqlHTTP({
        schema: new g.GraphQLSchema({
            query: new g.GraphQLObjectType({
                name: "Query",
                fields: fields,
            }),
        }),
        graphiql: true,
    });
};
