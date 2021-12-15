import {
    ContentGateway,
    createContentGateway,
    createDataRepositoryStub,
    createSchemaRepositoryStub,
    DataRepositoryStub,
    SchemaRepositoryStub
} from "@domain/feature-gateway";
import { extractRight } from "@shared/util-fp";
import { DEFAULT_CURSOR } from "@shared/util-loaders";
import {
    createSchemaFromClass,
    Data,
    Nested,
    NonEmptyProperty,
    RequiredObjectRef,
    Schema
} from "@shared/util-schema";
import * as express from "express";
import * as request from "supertest";
import { v4 as uuid } from "uuid";
import { generateContentGatewayAPIV1 } from "./ContentGatewayAPI";

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
// TODO: check stub activity too (was the stuff stored?)
describe("Given a content gateway api", () => {
    let app: express.Application;
    let gateway: ContentGateway;
    let dataRepositoryStub: DataRepositoryStub;
    let schemaRepositoryStub: SchemaRepositoryStub;
    let schemas: Map<string, Schema>;

    beforeEach(async () => {
        app = express();
        schemas = new Map();
        dataRepositoryStub = createDataRepositoryStub();
        schemaRepositoryStub = createSchemaRepositoryStub(schemas);
        gateway = createContentGateway({
            schemaRepository: schemaRepositoryStub,
            dataRepository: dataRepositoryStub,
        });
        app.use(
            "/",
            await generateContentGatewayAPIV1({
                app: app,
                contentGateway: gateway,
            })
        );
    });

    it("When a valid schema is sent, Then it registers", async () => {
        const schema = extractRight(createSchemaFromClass(User));
        const result = await request(app)
            .post("/schema/")
            .send(schema.toJson())
            .accept("text/plain")
            .expect(200);

        expect(result.status).toBe(200);
        expect(result.body).toEqual({});
    });

    it("When an invalid schema is sent, Then it fails", async () => {
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
                    "undefined was invalid: Schema information is invalid",
                    "undefined was invalid: A schema must have additional properties disabled. Did you add @AdditionalProperties(false)?",
                    "undefined was invalid: undefined",
                    "undefined was invalid: undefined",
                    "undefined was invalid: undefined",
                ],
            },
            cause: undefined,
        });
    });

    it("When a valid payload is sent, Then it is saved properly", async () => {
        const result = await request(app)
            .post("/data/receive")
            .send({
                info: userInfo,
                cursor: DEFAULT_CURSOR,
                data: generateUser(),
            })
            .accept("text/plain")
            .expect(200);

        expect(result.status).toBe(200);
        expect(result.body).toEqual({});
    });

    it("When an invalid payload is sent, Then it fails", async () => {
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
                    "undefined was invalid: Schema information is invalid",
                    "undefined was invalid: Data is not a valid json object",
                ],
            },
        });
    });

    it("When a valid batch payload is sent, Then it is saved properly", async () => {
        const users = [generateUser(), generateUser()];
        const result = await request(app)
            .post("/data/receive-batch")
            .send({
                info: userInfo,
                cursor: DEFAULT_CURSOR,
                data: users,
            })
            .accept("text/plain")
            .expect(200);

        expect(result.status).toBe(200);
        expect(result.body).toEqual({});
    });

    it("When an invalid batch payload is sent, Then it fails", async () => {
        const result = await request(app)
            .post("/data/receive-batch")
            .send({
                info: userInfo,
                cursor: 0,
                data: generateUser(),
            })
            .accept("text/plain")
            .expect(500);

        expect(result.status).toBe(500);

        expect(result.body).toEqual({
            message: "Validating json payload failed",
            _tag: "CodecValidationError",
            details: {
                errorReport: [
                    "[object Object] was invalid: Data is not a valid json array",
                ],
            },
        });
    });
});
