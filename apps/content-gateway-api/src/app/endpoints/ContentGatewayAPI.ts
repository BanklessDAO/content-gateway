import { ContentGateway } from "@domain/feature-gateway";
import { PayloadDTO, SchemaDTO } from "@shared/util-dto";
import {
    createDefaultJSONSerializer,
    createSchemaFromObject,
} from "@shared/util-schema";
import * as express from "express";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { Errors } from "io-ts";
import { failure } from "io-ts/lib/PathReporter";
import { Logger } from "tslog";

const logger = new Logger({ name: "ContentGatewayAPI" });
const dtoToSchema = createSchemaFromObject(createDefaultJSONSerializer());

type Deps = {
    gateway: ContentGateway;
    app: express.Application;
};

export const generateContentGatewayAPI = async ({ gateway, app }: Deps) => {
    app.use(
        express.json({
            strict: true,
        })
    );

    const router = express.Router();
    const objectToSchema = createSchemaFromObject(
        createDefaultJSONSerializer()
    );

    router.post("/register", async (req, res) => {
        logger.debug("Registering new schema...", req.body);
        await pipe(
            SchemaDTO.fromJSON(req.body),
            E.chainW((dto) => {
                logger.debug("Trying to convert dto to schema:", dto);
                return objectToSchema(dto.info, dto.schema);
            }),
            E.mapLeft((e: Errors) => {
                logger.warn(
                    "Can't create schema from object",
                    failure(e).join("\n")
                );
                return new Error("The supplied schema was invalid");
            }),
            TE.fromEither,
            TE.chain((schema) => {
                return gateway.register(schema);
            }),
            TE.fold(
                (e) => {
                    res.status(500).json({
                        result: "failure",
                        error: e.message,
                    });
                    return T.of(undefined);
                },
                () => {
                    res.status(200).json({
                        result: "ok",
                    });
                    return T.of(undefined);
                }
            )
        )();
    });
    router.post("/receive", async (req, res) => {
        await pipe(
            PayloadDTO.fromJSON(req.body),
            E.map(PayloadDTO.toPayload),
            TE.fromEither,
            TE.chain(gateway.receive),
            TE.fold(
                (e) => {
                    console.error("Receiving payload failed.", e);
                    res.status(500).json({
                        result: "failure",
                        error: e.message,
                    });
                    return T.of(undefined);
                },
                () => {
                    res.status(200).json({
                        result: "ok",
                    });
                    return T.of(undefined);
                }
            )
        )();
    });
    return router;
};
