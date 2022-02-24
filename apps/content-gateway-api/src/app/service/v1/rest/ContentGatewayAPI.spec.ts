import {
    base64Decode,
    base64Encode,
    extractRight,
} from "@banklessdao/util-misc";
import {
    createSchemaFromClass,
    Data,
    Nested,
    NonEmptyProperty,
    RequiredObjectRef,
    schemaInfoToString,
} from "@banklessdao/util-schema";
import {
    APIKey,
    APIKeyCodec,
    ContentGateway,
    ContentGatewayUser,
    createContentGateway,
    createDataRepositoryStub,
    createSchemaRepositoryStub,
    createUserRepositoryStub,
    DataRepository,
    SchemaEntity,
    SchemaRepository,
    UserRepository,
} from "@domain/feature-gateway";
import { DEFAULT_CURSOR } from "@shared/util-loaders";
import * as bcrypt from "bcrypt";
import * as express from "express";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { ObjectId } from "mongodb";
import * as request from "supertest";
import { v4 as uuid } from "uuid";
import { KeyCodec } from ".";
import { authorization } from "../../..";
import { createContentGatewayAPIV1 } from "./ContentGatewayAPI";

const userInfo = {
    namespace: "test",
    name: "User",
    version: "V1",
};

@Nested()
class Address {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name: string;
}

@Data({
    info: userInfo,
})
class User {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name: string;
    @RequiredObjectRef(Address)
    address: Address;
}

const generateUser = () => ({
    id: uuid(),
    name: "John",
    address: {
        id: uuid(),
        name: "Home",
    },
});

describe("Given a content gateway api", () => {
    let app: express.Application;
    let gateway: ContentGateway;

    let users: Map<string, ContentGatewayUser>;
    let schemas: Map<string, SchemaEntity>;

    let dataRepository: DataRepository;
    let schemaRepository: SchemaRepository;
    let userRepository: UserRepository;

    let apiKeyObj: APIKey;
    let apiKey: string;
    let adminUser: ContentGatewayUser;

    beforeEach(async () => {
        apiKeyObj = {
            id: uuid(),
            secret: "hey",
        };

        apiKey = base64Encode(JSON.stringify(apiKeyObj));

        adminUser = {
            id: uuid(),
            name: "admin",
            roles: ["admin"],
            apiKeys: [
                {
                    id: apiKeyObj.id,
                    hash: bcrypt.hashSync(apiKeyObj.secret, 10),
                },
            ],
        };
        app = express();

        users = new Map();
        users.set(adminUser.id, adminUser);

        schemas = new Map();

        dataRepository = createDataRepositoryStub();
        schemaRepository = createSchemaRepositoryStub(schemas);
        userRepository = createUserRepositoryStub(users);

        gateway = createContentGateway({
            schemaRepository,
            dataRepository,
            userRepository,
            authorization,
        });
        app.use(
            "/",
            await createContentGatewayAPIV1({
                app,
                userRepository: userRepository,
                contentGateway: gateway,
            })
        );
    });

    describe("When a user creation request is sent", () => {
        it("without API Key, Then it fails", async () => {
            const result = await request(app)
                .post("/user/")
                .send({
                    name: "John",
                    roles: ["admin"],
                })
                .accept("text/plain")
                .expect(500);

            expect(result.status).toBe(500);
            expect(result.body).toEqual({
                _tag: "AuthorizationError",
                details: {},
                message:
                    "Current user Anonymous has no permission to perform CREATE_USER",
            });
        });

        it("with an API Key, Then it succeeds", async () => {
            const result = await request(app)
                .post("/user/")
                .set({
                    "X-Api-Key": apiKey,
                })
                .send({
                    name: "John",
                    roles: ["user"],
                })
                .accept("text/plain")
                .expect(200);

            const expected = {
                apiKeys: [],
                name: "John",
                roles: ["user"],
            };

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...actual } = result.body;

            expect(result.status).toBe(200);
            expect(actual).toEqual(expected);
        });

        it("that is invalid, Then it fails", async () => {
            const result = await request(app)
                .post("/user/")
                .send({ hey: "ho" })
                .expect(500);

            expect(result.status).toBe(500);

            expect(result.body).toEqual({
                message: "Validating create user params failed",
                _tag: "CodecValidationError",
                cause: undefined,
                details: {
                    errorReport: [
                        "name must be a string",
                        "roles must be an array of strings",
                    ],
                },
            });
        });
    });

    describe("When a user deletion request is sent", () => {
        it("without API Key, Then it fails", async () => {
            const result = await request(app)
                .delete("/user/")
                .send({
                    id: adminUser.id,
                })
                .accept("text/plain")
                .expect(500);

            expect(result.status).toBe(500);
            expect(result.body).toEqual({
                _tag: "AuthorizationError",
                details: {},
                message:
                    "Current user Anonymous has no permission to perform DELETE_USER",
            });
        });

        it("with an API Key, Then it succeeds", async () => {
            const result = await request(app)
                .delete("/user/")
                .set({
                    "X-Api-Key": apiKey,
                })
                .send({
                    id: adminUser.id,
                })
                .accept("text/plain")
                .expect(200);

            expect(result.status).toBe(200);
            expect(result.body).toEqual({});
        });

        it("that is invalid, Then it fails", async () => {
            const result = await request(app)
                .delete("/user/")
                .send({ foo: "bar" })
                .expect(500);

            expect(result.status).toBe(500);

            expect(result.body).toEqual({
                message: "Validating delete user params failed",
                _tag: "CodecValidationError",
                cause: undefined,
                details: {
                    errorReport: ["id must be a string"],
                },
            });
        });
    });

    describe("When an API key creation request is sent", () => {
        it("without API Key, Then it fails", async () => {
            const result = await request(app)
                .post("/user/api-key")
                .send({
                    id: adminUser.id,
                })
                .accept("text/plain")
                .expect(500);

            expect(result.status).toBe(500);
            expect(result.body).toEqual({
                _tag: "AuthorizationError",
                details: {},
                message:
                    "Current user Anonymous has no permission to perform CREATE_API_KEY",
            });
        });

        it("with an API Key, Then it succeeds", async () => {
            const result = await request(app)
                .post("/user/api-key")
                .set({
                    "X-Api-Key": apiKey,
                })
                .send({
                    id: adminUser.id,
                })
                .accept("text/plain")
                .expect(200);

            expect(result.status).toBe(200);

            const key = pipe(
                KeyCodec.decode(result.body),
                E.map((v) => JSON.parse(base64Decode(v.key))),
                E.chain(APIKeyCodec.decode),
                extractRight
            );
            // const id = uuid();
            // const secret = uuid();
            // const k = {
            //     id,
            //     secret,
            // };
            // console.log(k);
            // console.log(
            //     `api key: ${base64Encode(
            //         JSON.stringify(k)
            //     )}`
            // );
            // const rootUser = {
            //     id: new ObjectId().toString(),
            //     name: "root",
            //     roles: ["root"],
            //     apiKeys: [
            //         {
            //             id,
            //             hash: bcrypt.hashSync(secret, 10),
            //         },
            //     ],
            // };
            // console.log(rootUser);
            // console.log(`user: ${base64Encode(JSON.stringify(rootUser))}`);
            expect(key).toBeTruthy();
        });

        it("that is invalid, Then it fails", async () => {
            const result = await request(app)
                .post("/user/api-key")
                .send({ hey: "ho" })
                .expect(500);

            expect(result.status).toBe(500);

            expect(result.body).toEqual({
                message: "Validating create api key params failed",
                _tag: "CodecValidationError",
                cause: undefined,
                details: {
                    errorReport: ["id must be a string"],
                },
            });
        });
    });

    describe("When an API key deletion request is sent", () => {
        it("without API Key, Then it fails", async () => {
            const result = await request(app)
                .delete("/user/api-key")
                .send({
                    key: apiKey,
                })
                .accept("text/plain")
                .expect(500);

            expect(result.status).toBe(500);
            expect(result.body).toEqual({
                _tag: "AuthorizationError",
                details: {},
                message:
                    "Current user Anonymous has no permission to perform DELETE_API_KEY",
            });
        });

        it("with an API Key, Then it succeeds", async () => {
            const result = await request(app)
                .delete("/user/api-key")
                .set({
                    "X-Api-Key": apiKey,
                })
                .send({
                    key: apiKey,
                })
                .accept("text/plain")
                .expect(200);

            expect(result.status).toBe(200);
            expect(result.body).toEqual({});
        });

        it("that is invalid, Then it fails", async () => {
            const result = await request(app)
                .delete("/user/api-key")
                .send({ xul: "wom" })
                .expect(500);

            expect(result.status).toBe(500);

            expect(result.body).toEqual({
                message: "Validating delete api key params failed",
                _tag: "CodecValidationError",
                cause: undefined,
                details: {
                    errorReport: ["key must be a string"],
                },
            });
        });
    });

    describe("When a schema registration request is sent", () => {
        it("without API Key, Then it fails", async () => {
            const schema = extractRight(createSchemaFromClass(User));
            const result = await request(app)
                .post("/schema/")
                .send(schema.toJson())
                .accept("text/plain")
                .expect(500);

            expect(result.status).toBe(500);
            expect(result.body).toEqual({
                _tag: "AuthorizationError",
                details: {},
                message:
                    "Current user Anonymous has no permission to perform REGISTER_SCHEMA",
            });
        });

        it("with API Key, Then it succeeds", async () => {
            const schema = extractRight(createSchemaFromClass(User));

            const result = await request(app)
                .post("/schema/")
                .set({
                    "X-Api-Key": apiKey,
                })
                .send(schema.toJson())
                .accept("text/plain")
                .expect(200);

            expect(result.status).toBe(200);
            expect(result.body).toEqual({});
        });

        it("that is invalid, Then it fails", async () => {
            const result = await request(app)
                .post("/schema/")
                .send({ hey: "ho" })
                .expect(500);

            expect(result.status).toBe(500);

            expect(result.body).toEqual({
                message: "JSON Schema validation failed.",
                _tag: "CodecValidationError",
                details: {
                    errorReport: [
                        "Schema information is invalid",
                        "A schema must have additional properties disabled. Did you add @AdditionalProperties(false)?",
                        "Schema type is missing",
                        // ! TODO: this is a problem with the codec (withMessage)
                        "Value was invalid",
                        "Value was invalid",
                    ],
                },
                cause: undefined,
            });
        });
    });

    describe("When a save data request is sent", () => {
        it("with an API key, Then it is saved properly", async () => {
            const schema = extractRight(createSchemaFromClass(User));

            schemas.set(schemaInfoToString(schema.info), {
                ...schema,
                owner: adminUser,
            });

            const result = await request(app)
                .post("/data/receive")
                .set({
                    "X-Api-Key": apiKey,
                })
                .send({
                    info: userInfo,
                    cursor: DEFAULT_CURSOR,
                    data: [generateUser()],
                })
                .accept("text/plain")
                .expect(200);

            expect(result.status).toBe(200);
            expect(result.body).toEqual({});
        });

        it("without API key, Then it fails", async () => {
            const result = await request(app)
                .post("/data/receive")
                .send({
                    info: userInfo,
                    cursor: DEFAULT_CURSOR,
                    data: [generateUser()],
                })
                .accept("text/plain")
                .expect(500);

            expect(result.status).toBe(500);
            expect(result.body).toEqual({
                _tag: "AuthorizationError",
                details: {},
                message:
                    "Current user Anonymous has no permission to perform FIND_SCHEMA_FOR",
            });
        });

        it("which is invalid, Then it fails", async () => {
            const result = await request(app)
                .post("/data/receive")
                .send({ hey: "ho" })
                .expect(500);

            expect(result.status).toBe(500);

            expect(result.body).toEqual({
                message: "Validating json payload failed",
                _tag: "CodecValidationError",
                details: {
                    errorReport: [
                        "Schema information is invalid",
                        "Data is not a valid json array",
                    ],
                },
            });
        });
    });
});
