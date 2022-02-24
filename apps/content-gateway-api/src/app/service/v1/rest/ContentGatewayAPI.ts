import {
    jsonBatchPayloadCodec,
    mapCodecValidationError,
    ProgramError,
    programErrorCodec,
    schemaInfoCodec
} from "@banklessdao/util-data";
import {
    base64Decode,
    base64Encode,
    createLogger
} from "@banklessdao/util-misc";
import { createSchemaFromObject } from "@banklessdao/util-schema";
import {
    APIKeyCodec,
    ContentGateway,
    ContentGatewayUser,
    CreateUserParamsCodec,
    InvalidAPIKeyError,
    UserRepository
} from "@domain/feature-gateway";
import { Context } from "@shared/util-auth";
import * as bcrypt from "bcrypt";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/lib/Task";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { ANON_USER } from "../../..";

const logger = createLogger("ContentGatewayAPI");

type Deps = {
    app: express.Application;
    userRepository: UserRepository;
    contentGateway: ContentGateway;
};

export const KeyCodec = t.strict({
    key: withMessage(t.string, () => "key must be a string"),
});

/**
 * This is the REST API of Content Gateway that is used
 * by the Content Gateway Client
 */
export const createContentGatewayAPIV1 = async ({
    app,
    userRepository,
    contentGateway,
}: Deps) => {
    app.use(
        express.json({
            strict: true,
            limit: "50mb",
        })
    );

    const router = express.Router();

    const extractUser = (
        req: express.Request
    ): TE.TaskEither<ProgramError, ContentGatewayUser> => {
        const key = req.header("X-Api-Key");
        if (!key) {
            return TE.of(ANON_USER);
        } else {
            return pipe(
                TE.Do,
                TE.bind("decodedKey", () =>
                    TE.right(JSON.parse(base64Decode(key)))
                ),
                TE.bindW("apiKey", ({ decodedKey }) => {
                    return TE.fromEither(APIKeyCodec.decode(decodedKey));
                }),
                TE.mapLeft(() => {
                    return new InvalidAPIKeyError("API key was invalid");
                }),
                TE.bindW("user", ({ apiKey }) => {
                    return userRepository.findByApiKeyId(apiKey.id);
                }),
                TE.chainW(({ apiKey, user }) => {
                    return TE.tryCatch(
                        async () => {
                            // * We know that the user is not null because we checked it above
                            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                            const actualKey = user.apiKeys.find(
                                (k) => k.id === apiKey.id
                            )!;
                            const isValid = await bcrypt.compare(
                                apiKey.secret,
                                actualKey.hash
                            );
                            if (!isValid) {
                                throw new Error("Invalid API Key");
                            }
                            return user;
                        },
                        () =>
                            new InvalidAPIKeyError(
                                "The supplied API key was invalid."
                            )
                    );
                })
            );
        }
    };

    const extractBody = <T>(
        req: express.Request,
        codec: t.Type<T>
    ): TE.TaskEither<ProgramError, T> => {
        return pipe(
            codec.decode(req.body),
            mapCodecValidationError("Validating json payload failed"),
            TE.fromEither
        );
    };

    const UserIdCodec = withMessage(
        t.strict({
            id: t.string,
        }),
        () => "id must be a string"
    );

    router.post("/user/", async (req, res) => {
        await pipe(
            TE.Do,
            TE.bind("currentUser", () => extractUser(req)),
            TE.bindW("newUser", () =>
                TE.fromEither(
                    pipe(
                        CreateUserParamsCodec.decode(req.body),
                        mapCodecValidationError(
                            "Validating create user params failed"
                        )
                    )
                )
            ),
            TE.map(({ currentUser, newUser }) => ({
                currentUser,
                data: newUser,
            })),
            contentGateway.createUser,
            sendResponse(res, "User creation")
        )();
    });

    router.delete("/user/", async (req, res) => {
        await pipe(
            TE.Do,
            TE.bind("currentUser", () => extractUser(req)),
            TE.bindW("userId", () =>
                TE.fromEither(
                    pipe(
                        UserIdCodec.decode(req.body),
                        mapCodecValidationError(
                            "Validating delete user params failed"
                        )
                    )
                )
            ),
            TE.bindW("user", ({ userId }) => {
                return userRepository.findById(userId.id);
            }),
            TE.map(({ currentUser, user }) => ({
                currentUser,
                data: { user },
            })),
            contentGateway.deleteUser,
            sendResponse(res, "User deletion")
        )();
    });

    router.post("/user/api-key", async (req, res) => {
        await pipe(
            TE.Do,
            TE.bind("currentUser", () => extractUser(req)),
            TE.bindW("userId", () =>
                TE.fromEither(
                    pipe(
                        UserIdCodec.decode(req.body),
                        mapCodecValidationError(
                            "Validating create api key params failed"
                        )
                    )
                )
            ),
            TE.bindW("owner", ({ userId }) => {
                return userRepository.findById(userId.id);
            }),
            TE.map(({ currentUser, owner }) => ({
                currentUser,
                data: { owner },
            })),
            contentGateway.createAPIKey,
            TE.map((ctx) => {
                return {
                    currentUser: ctx.currentUser,
                    data: {
                        key: base64Encode(JSON.stringify(ctx.data)),
                    },
                };
            }),
            sendResponse(res, "API key creation")
        )();
    });

    router.delete("/user/api-key", async (req, res) => {
        await pipe(
            TE.Do,
            TE.bind("currentUser", () => extractUser(req)),
            TE.bindW("key", () =>
                TE.fromEither(
                    pipe(
                        KeyCodec.decode(req.body),
                        E.map((key) => {
                            return JSON.parse(base64Decode(key.key));
                        }),
                        E.chainW((key) => {
                            return APIKeyCodec.decode(key);
                        }),
                        mapCodecValidationError(
                            "Validating delete api key params failed"
                        )
                    )
                )
            ),
            TE.bindW("owner", ({ key }) => {
                return userRepository.findByApiKeyId(key.id);
            }),
            TE.map(({ currentUser, owner, key }) => ({
                currentUser,
                data: { owner, apiKeyId: key.id },
            })),
            contentGateway.deleteAPIKey,
            sendResponse(res, "API key deletion creation")
        )();
    });

    router.post("/schema/", async (req, res) => {
        await pipe(
            TE.Do,
            TE.bind("currentUser", () => extractUser(req)),
            TE.bindW("schema", () =>
                TE.fromEither(createSchemaFromObject(req.body))
            ),
            TE.map(({ currentUser, schema }) => ({
                currentUser,
                data: {
                    schema: schema,
                    // * 👇 We can register for another user in the future
                    owner: currentUser,
                },
            })),
            contentGateway.registerSchema,
            sendResponse(res, "Schema registration")
        )();
    });

    router.delete("/schema/", async (req, res) => {
        // TODO: move this outer pipe into a function
        // TODO: do status reporting in sendResponse only based on the error type (400 vs 500)
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
                (schemaInfo) => {
                    return pipe(
                        extractUser(req),
                        TE.map((currentUser) => ({
                            currentUser,
                            data: schemaInfo,
                        })),
                        contentGateway.removeSchema,
                        sendResponse(res, "Remove schema")
                    )();
                }
            )
        );
    });

    router.get("/schema/stats", async (req, res) => {
        await pipe(
            extractUser(req),
            TE.map((currentUser) => ({
                currentUser,
                data: undefined,
            })),
            contentGateway.loadSchemaStats,
            sendResponse(res, "Schema stats")
        )();
    });

    router.post("/data/receive", async (req, res) => {
        return pipe(
            TE.Do,
            // 👇 we can skip the context mapping phase as these two form a context
            TE.bind("currentUser", () => extractUser(req)),
            TE.bindW("payload", () => extractBody(req, jsonBatchPayloadCodec)),
            TE.map(({ currentUser, payload }) => {
                return {
                    currentUser,
                    data: {
                        info: payload.info,
                        records: payload.data,
                    },
                };
            }),
            contentGateway.saveData,
            sendResponse(res, "Payload receiving ")
        )();
    });

    return router;
};

const sendResponse = <O>(res: express.Response, operation: string) =>
    TE.fold(
        (e: ProgramError) => {
            logger.warn(`${operation} failed`, e);
            res.status(500).json(programErrorCodec.encode(e));
            return T.of(undefined);
        },
        (ctx: Context<O>) => {
            res.status(200).send(ctx.data === undefined ? {} : ctx.data);
            return T.of(undefined);
        }
    );
