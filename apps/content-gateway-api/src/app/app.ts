import { createContentGatewayClient } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cga/prisma";
import { createContentGateway } from "@domain/feature-gateway";
import { createLoaderRegistry } from "@domain/feature-loaders";
import { createLogger, programError } from "@shared/util-fp";
import * as express from "express";
import { join } from "path";
import { createInMemoryOutboundDataAdapter } from ".";
import {
    AppContext,
    createPrismaDataRepository,
    createPrismaSchemaRepository
} from "./";
import { generateContentGatewayAPI } from "./service";
import {
    createGraphQLAPIService,
    toObservableSchemaRepository
} from "./service/graphql/GraphQLAPIService";

const env = process.env.NODE_ENV ?? programError("NODE_ENV not set");
const isDev = env === "development";
const isProd = env === "production";
const resetDb = process.env.RESET_DB === "true";

export const createAPI = async (prisma: PrismaClient) => {
    const logger = createLogger("app");
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

    const loaderRegistry = createLoaderRegistry();

    const contentGateway = createContentGateway(
        schemaRepository,
        dataRepository
    );
    const client = createContentGatewayClient({
        adapter: createInMemoryOutboundDataAdapter({
            contentGateway,
        }),
    });

    const appContext: AppContext = {
        logger: logger,
        env,
        isDev,
        isProd,
        app,
        prisma,
        schemaRepository,
        dataRepository,
        loaderRegistry,
        contentGateway,
        client,
    };

    const clientBuildPath = join(__dirname, "../content-gateway-frontend");

    app.use("/api/rest/", await generateContentGatewayAPI(appContext));
    app.use("/api/graphql/", await createGraphQLAPIService(appContext));

    if (isProd) {
        app.use(express.static(clientBuildPath));
        app.get("*", (_, response) => {
            response.sendFile(join(clientBuildPath, "index.html"));
        });
    }

    return app;
};
