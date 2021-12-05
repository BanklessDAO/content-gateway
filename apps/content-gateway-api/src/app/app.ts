/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    ContentGatewayClient,
    createContentGatewayClient,
} from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cga/prisma";
import {
    ContentGateway,
    createContentGateway,
    DataRepository,
    SchemaRepository,
} from "@domain/feature-gateway";
import { createLogger, programError } from "@shared/util-fp";
import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import { join } from "path";
import { Logger } from "tslog";
import {
    createGraphQLAPIService,
    createInMemoryOutboundDataAdapter,
    ObservableSchemaRepository,
    toObservableSchemaRepository,
} from ".";
import { createPrismaDataRepository, createPrismaSchemaRepository } from "./";
import { generateContentGatewayAPI } from "./service";
import * as g from "graphql";
import { LiveLoader } from "./live-loaders/LiveLoader";
import { liveLoaders } from "./live-loaders";

export type ApplicationContext = {
    logger: Logger;
    env: string;
    isDev: boolean;
    isProd: boolean;
    app: express.Application;
    prisma: PrismaClient;
    schemaRepository: ObservableSchemaRepository;
    dataRepository: DataRepository;
    contentGateway: ContentGateway;
    client: ContentGatewayClient;
};

export const createApp = async (prisma: PrismaClient) => {
    const env = process.env.NODE_ENV ?? programError("NODE_ENV not set");
    const isDev = env === "development";
    const isProd = env === "production";
    const resetDb = process.env.RESET_DB === "true";
    const addFrontend = process.env.ADD_FRONTEND === "true";

    const logger = createLogger("ContentGatewayAPIApp");

    if (resetDb) {
        await prisma.data.deleteMany({});
        await prisma.schema.deleteMany({});
    }
    logger.info(`Running in ${env} mode`);

    const app = express();
    const schemaRepository = toObservableSchemaRepository(
        createPrismaSchemaRepository(prisma)
    );
    const dataRepository = createPrismaDataRepository(prisma, schemaRepository);

    const contentGateway = createContentGateway({
        schemaRepository,
        dataRepository,
    });
    const client = createContentGatewayClient({
        adapter: createInMemoryOutboundDataAdapter({
            contentGateway,
        }),
    });

    const context: ApplicationContext = {
        logger: logger,
        env,
        isDev,
        isProd,
        app,
        prisma,
        schemaRepository,
        dataRepository,
        contentGateway,
        client,
    };

    app.use("/api/rest/", await generateContentGatewayAPI(context));
    app.use("/api/graphql/", await createGraphQLAPIService(context));
    app.use(
        "/api/graphql-live",
        createGraphQLLiveService({
            liveLoaders: liveLoaders,
        })
    );

    const clientBuildPath = join(__dirname, "../content-gateway-api-frontend");
    if (addFrontend || isProd) {
        app.use(express.static(clientBuildPath));
        app.get("*", (_, response) => {
            response.sendFile(join(clientBuildPath, "index.html"));
        });
    }

    return app;
};

type Deps = {
    readonly liveLoaders: LiveLoader<any, any>[];
};

export const createGraphQLLiveService = (deps: Deps) => {
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
