import { createClient } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cga/prisma";
import { createContentGateway } from "@domain/feature-gateway";
import { PayloadDTO, SchemaDTO } from "@shared/util-dto";
import {
    createDefaultJSONSerializer,
    createSchemaFromObject,
} from "@shared/util-schema";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { Errors } from "io-ts";
import { failure } from "io-ts/lib/PathReporter";
import { join } from "path";
import { Logger } from "tslog";
import { AppContext, generateFixtures } from "../";
import { createPrismaDataStorage, createPrismaSchemaStorage } from "./";
import { generateContentGatewayAPI } from "./endpoints/ContentGatewayAPI";
import { generateGraphQLAPI } from "./endpoints/GraphQLAPI";

const env = process.env.NODE_ENV;
const isDev = env === "development";
const isProd = env === "production";
const logger = new Logger({ name: "main" });

export const createApp = async (prisma: PrismaClient) => {
    logger.info(`Running in ${env} mode`);

    const app = express();
    const serializer = createDefaultJSONSerializer();
    const deserializeSchemaFromObject = createSchemaFromObject(serializer);

    const schemaStorage = createPrismaSchemaStorage(
        deserializeSchemaFromObject,
        prisma
    );
    const dataStorage = createPrismaDataStorage(
        deserializeSchemaFromObject,
        prisma
    );

    const gateway = createContentGateway(schemaStorage, dataStorage);

    const client = createClient({
        serializer,
        adapter: {
            register: (schema): TE.TaskEither<Error, void> => {
                return pipe(
                    SchemaDTO.fromJSON(schema),
                    E.chainW((dto) =>
                        deserializeSchemaFromObject(dto.info, dto.schema)
                    ),
                    TE.fromEither,
                    TE.chainW(gateway.register),
                    TE.mapLeft((err: Errors) => new Error(failure(err).join("\n")))
                );
            },
            send: (payload): TE.TaskEither<Error, void> => {
                return pipe(
                    PayloadDTO.fromJSON(payload),
                    E.map((dto) => PayloadDTO.toPayload(dto)),
                    TE.fromEither,
                    TE.chain(gateway.receive),
                    TE.chain(() => TE.of(undefined))
                );
            },
            sendBatch: (payload): TE.TaskEither<Error, void> => {
                return pipe(
                    PayloadDTO.fromJSON(payload),
                    E.map((dto) => PayloadDTO.toPayload(dto)),
                    TE.fromEither,
                    TE.chain(gateway.receiveBatch),
                    TE.chain(() => TE.of(undefined))
                );
            },
        },
    });

    const appContext: AppContext = {
        logger,
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

    if (isDev) {
        await generateFixtures(prisma, client);
    }

    const clientBuildPath = join(__dirname, "../content-gateway-frontend");

    app.use("/api/graphql", await generateGraphQLAPI(appContext));
    app.use("/api/rest/", await generateContentGatewayAPI(appContext));

    if (isProd) {
        app.use(express.static(clientBuildPath));
        app.get("*", (request, response) => {
            response.sendFile(join(clientBuildPath, "index.html"));
        });
    }

    return app;
};
