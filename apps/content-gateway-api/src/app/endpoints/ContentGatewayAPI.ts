import { ContentGateway } from "@domain/feature-gateway";
import {
    batchPayloadCodec,
    createSchemaFromObject,
    payloadCodec,
} from "@shared/util-schema";
import * as express from "express";
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import { Errors } from "io-ts";
import { formatValidationErrors } from "io-ts-reporters";
import { Logger } from "tslog";

const logger = new Logger({ name: "ContentGatewayAPI" });

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

    router.post("/register", async (req, res) => {
        logger.info("Validating new schema...");
        await pipe(
            createSchemaFromObject(req.body),
            mapErrors("The supplied schema was invalid"),
            TE.fromEither,
            TE.chain((schema) => {
                logger.info("Schema was valid, registering...");
                return gateway.register(schema);
            }),
            createResponseTask(res)
        )();
    });

    router.post("/receive", async (req, res) => {
        logger.info("Validating payload...");
        await pipe(
            payloadCodec.decode(req.body),
            mapErrors("Validating payload..."),
            TE.fromEither,
            TE.chain((data) => {
                logger.info("Payload was valid, receiving...");
                return gateway.receive(data);
            }),
            createResponseTask(res)
        )();
    });

    router.post("/receive-batch", async (req, res) => {
        logger.info("Validating batch payload...");
        await pipe(
            batchPayloadCodec.decode(req.body),
            mapErrors("The supplied payload batch was invalid"),
            TE.fromEither,
            TE.chain((data) => {
                logger.info("Batch payload was valid, receiving...");
                return gateway.receive(data);
            }),
            createResponseTask(res)
        )();
    });

    return router;
};

const mapErrors = (msg: string) =>
    E.mapLeft((e: Errors) => {
        logger.warn(msg, formatValidationErrors(e));
        return new Error(msg);
    });

const createResponseTask = (res: express.Response) =>
    TE.fold(
        (e: Error) => {
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
    );
