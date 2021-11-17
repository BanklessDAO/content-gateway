import { createClient } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cga/prisma";
import { createContentGateway } from "@domain/feature-gateway";
import { createLogger } from "@shared/util-fp";
import {
    batchPayloadCodec,
    createSchemaFromObject,
    payloadCodec
} from "@shared/util-schema";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { Errors } from "io-ts";
import { formatValidationErrors } from "io-ts-reporters";
import { failure } from "io-ts/lib/PathReporter";
import { join } from "path";
import {
    AppContext, createPrismaDataStorage,
    createPrismaSchemaStorage
} from "./";
import { generateContentGatewayAPI } from "./endpoints";
import {
    createGraphQLAPI,
    decorateSchemaStorage
} from "./endpoints/graphql/GraphQLAPI";

const env = process.env.NODE_ENV;
const isDev = env === "development";
const isProd = env === "production";

export const createAPI = async (prisma: PrismaClient) => {
    const logger = createLogger("app");
    if (isDev) {
        await prisma.data.deleteMany({});
        await prisma.schema.deleteMany({});
    }
    logger.info(`Running in ${env} mode`);

    const app = express();
    const schemaStorage = decorateSchemaStorage(
        createPrismaSchemaStorage(prisma)
    );
    const dataStorage = createPrismaDataStorage(prisma, schemaStorage);

    const gateway = createContentGateway(schemaStorage, dataStorage);

    const client = createClient({
        adapter: {
            register: (schema): TE.TaskEither<Error, void> => {
                return pipe(
                    createSchemaFromObject(schema),
                    TE.fromEither,
                    TE.chainW(gateway.register),
                    TE.mapLeft(
                        (err: Errors) => new Error(failure(err).join("\n"))
                    )
                );
            },
            send: (payload): TE.TaskEither<Error, void> => {
                return pipe(
                    payloadCodec.decode(payload),
                    E.mapLeft(
                        (err: Errors) =>
                            new Error(formatValidationErrors(err).join())
                    ),
                    TE.fromEither,
                    TE.chain(gateway.receive),
                    TE.chain(() => TE.of(undefined))
                );
            },
            sendBatch: (payload): TE.TaskEither<Error, void> => {
                return pipe(
                    batchPayloadCodec.decode(payload),
                    E.mapLeft(
                        (err: Errors) =>
                            new Error(formatValidationErrors(err).join())
                    ),
                    TE.fromEither,
                    TE.chain(gateway.receiveBatch),
                    TE.chain(() => TE.of(undefined))
                );
            },
        },
    });

    const appContext: AppContext = {
        logger: logger,
        env,
        isDev,
        isProd,
        app,
        prisma,
        schemaStorage,
        dataStorage,
        gateway,
        client,
    };

    const clientBuildPath = join(__dirname, "../content-gateway-frontend");

    app.use("/api/rest/", await generateContentGatewayAPI(appContext));
    app.use("/api/graphql/", await createGraphQLAPI(appContext));

    if (isProd) {
        app.use(express.static(clientBuildPath));
        app.get("*", (_, response) => {
            response.sendFile(join(clientBuildPath, "index.html"));
        });
    }

    return app;
};
