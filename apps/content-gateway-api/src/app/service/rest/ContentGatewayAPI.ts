import {
    jsonBatchPayloadCodec,
    jsonPayloadCodec
} from "@banklessdao/content-gateway-client";
import { ContentGateway } from "@domain/feature-gateway";
import { createLogger } from "@shared/util-fp";
import { createSchemaFromObject } from "@shared/util-schema";
import * as express from "express";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { Errors } from "io-ts";
import { formatValidationErrors } from "io-ts-reporters";

const logger = createLogger("ContentGatewayAPI");

type Deps = {
    contentGateway: ContentGateway;
    app: express.Application;
};

/**
 * This is the REST API of Content Gateway that is used
 * by the Content Gateway Client
 */
export const generateContentGatewayAPI = async ({
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

    router.post("/register", async (req, res) => {
        await pipe(
            createSchemaFromObject(req.body),
            mapErrors("The supplied schema was invalid"),
            TE.fromEither,
            TE.chain((schema) => {
                return contentGateway.register(schema);
            }),
            createResponseTask(res, "Schema registration")
        )();
    });

    router.post("/receive", async (req, res) => {
        await pipe(
            jsonPayloadCodec.decode(req.body),
            mapErrors("Validating payload failed"),
            TE.fromEither,
            TE.chain((data) => {
                return contentGateway.receive(data);
            }),
            createResponseTask(res, "Payload receiving ")
        )();
    });

    router.post("/receive-batch", async (req, res) => {
        logger.info("Receiving batch...");
        await pipe(
            jsonBatchPayloadCodec.decode(req.body),
            mapErrors("The supplied payload batch was invalid"),
            TE.fromEither,
            TE.chain((data) => {
                logger.info("Batch was valid, sending to gateway...");
                return contentGateway.receiveBatch(data);
            }),
            createResponseTask(res, "Batch payload receiving")
        )();
    });

    return router;
};

const mapErrors = (msg: string) =>
    E.mapLeft((e: Errors) => {
        logger.warn(msg, formatValidationErrors(e));
        return new Error(msg);
    });

const createResponseTask = (res: express.Response, operation: string) =>
    TE.fold(
        (e: Error) => {
            res.status(500).json({
                result: "failure",
                error: e.message,
            });
            logger.warn(`${operation} failed`, e);
            return T.of(undefined);
        },
        () => {
            res.status(200).json({
                result: "ok",
            });
            return T.of(undefined);
        }
    );
