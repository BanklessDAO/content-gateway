import { ContentGateway } from "@domain/feature-gateway";
import {
    jsonBatchPayloadCodec,
    jsonPayloadCodec,
    mapCodecValidationError,
    ProgramError,
    programErrorCodec,
    schemaInfoCodec,
} from "@shared/util-data";
import { createLogger } from "@shared/util-fp";
import { createSchemaFromObject } from "@shared/util-schema";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";

const logger = createLogger("ContentGatewayAPI");

type Deps = {
    contentGateway: ContentGateway;
    app: express.Application;
};

/**
 * This is the REST API of Content Gateway that is used
 * by the Content Gateway Client
 */
export const generateContentGatewayAPIV1 = async ({
    contentGateway,
    app,
}: Deps) => {
    app.use(
        express.json({
            strict: true,
            limit: "50mb",
        })
    );

    const router = express.Router();

    router.get("/schema/stats", async (_, res) => {
        await pipe(
            contentGateway.loadStats(),
            TE.fromTask,
            sendResponse(res, "Schema stats")
        )();
    });

    router.delete("/schema/", async (req, res) => {
        pipe(
            schemaInfoCodec.decode(req.body),
            E.fold(
                (errors) => {
                    res.status(400).send(
                        errors.map(
                            (e) => `${e.value} was invalid: ${e.message}`
                        )
                    );
                },
                (params) => {
                    return pipe(
                        contentGateway.remove(params),
                        sendResponse(res, "Remove schema")
                    )();
                }
            )
        );
    });

    router.post("/schema/", async (req, res) => {
        await pipe(
            createSchemaFromObject(req.body),
            TE.fromEither,
            TE.chainW(contentGateway.register),
            TE.map(() => ({})),
            sendResponse(res, "Schema registration")
        )();
    });

    router.post("/data/receive", async (req, res) => {
        return pipe(
            jsonPayloadCodec.decode(req.body),
            mapCodecValidationError("Validating json payload failed"),
            TE.fromEither,
            TE.chainW(contentGateway.receive),
            TE.map(() => ({})),
            sendResponse(res, "Payload receiving ")
        )();
    });

    router.post("/data/receive-batch", async (req, res) => {
        logger.info("Receiving batch...");
        await pipe(
            jsonBatchPayloadCodec.decode(req.body),
            mapCodecValidationError("Validating json payload failed"),
            TE.fromEither,
            TE.chainW(contentGateway.receiveBatch),
            TE.map(() => ({})),
            sendResponse(res, "Batch payload receiving")
        )();
    });

    return router;
};

const sendResponse = (res: express.Response, operation: string) =>
    TE.fold(
        (e: ProgramError) => {
            logger.warn(`${operation} failed`, e);
            res.status(500).json(programErrorCodec.encode(e));
            return T.of(undefined);
        },
        (data) => {
            res.status(200).send(data);
            return T.of(undefined);
        }
    );
