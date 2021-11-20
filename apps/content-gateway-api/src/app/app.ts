import { createContentGatewayClient } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cga/prisma";
import { createContentGateway } from "@domain/feature-gateway";
import { createLogger, programError } from "@shared/util-fp";
import * as express from "express";
import { join } from "path";
import { createInMemoryOutboundDataAdapter } from ".";
import {
    ApplicationContext,
    createPrismaDataRepository,
    createPrismaSchemaRepository,
} from "./";
import { generateContentGatewayAPI } from "./service";
import {
    createGraphQLAPIService,
    toObservableSchemaRepository,
} from "./service/graphql/GraphQLAPIService";

export const createAPI = async (prisma: PrismaClient) => {
    const env = process.env.NODE_ENV ?? programError("NODE_ENV not set");
    const isDev = env === "development";
    const isProd = env === "production";
    const resetDb = process.env.RESET_DB === "false";
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

    const contentGateway = createContentGateway(
        schemaRepository,
        dataRepository
    );
    const client = createContentGatewayClient({
        adapter: createInMemoryOutboundDataAdapter({
            contentGateway,
        }),
    });

    const appContext: ApplicationContext = {
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
