import {
    ContentGateway,
    createContentGateway,
    createDataRepositoryStub,
    createSchemaRepositoryStub,
    DataRepositoryStub,
    SchemaRepositoryStub,
} from "@domain/feature-gateway";
import { extractRight } from "@shared/util-fp";
import { createSchemaFromType, Schema } from "@shared/util-schema";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as express from "express";
import * as request from "supertest";
import { v4 as uuid } from "uuid";
import { generateContentGatewayAPI } from "./ContentGatewayAPI";

const userInfo = {
    namespace: "test",
    name: "User",
    version: "V1",
};

class Address {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
}

@AdditionalProperties(false)
class User {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
    @Required(true)
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
        gateway = createContentGateway(schemaRepositoryStub, dataRepositoryStub);
        app.use(
            "/",
            await generateContentGatewayAPI({
                app: app,
                gateway: gateway,
            })
        );
    });

    it("When a valid schema is sent, Then it registers", async () => {
        const schema = extractRight(createSchemaFromType(userInfo, User));
        const result = await request(app)
            .post("/register")
            .send(schema.toJson())
            .accept("text/plain")
            .expect(200);

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ result: "ok" });
    });

    it("When an invalid schema is sent, Then it fails", async () => {
        const result = await request(app)
            .post("/register")
            .send({ hey: "ho" })
            .expect(500);

        expect(result.status).toBe(500);
        expect(result.body).toEqual({
            result: "failure",
            error: "The supplied schema was invalid",
        });
    });

    it("When a valid payload is sent, Then it is saved properly", async () => {
        const result = await request(app)
            .post("/receive")
            .send({
                info: userInfo,
                cursor: 0,
                data: generateUser(),
            })
            .accept("text/plain")
            .expect(200);

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ result: "ok" });
    });

    it("When an invalid payload is sent, Then it fails", async () => {
        const result = await request(app)
            .post("/receive")
            .send({ hey: "ho" })
            .expect(500);

        expect(result.status).toBe(500);
        expect(result.body).toEqual({
            result: "failure",
            error: "Validating payload failed",
        });
    });

    it("When a valid batch payload is sent, Then it is saved properly", async () => {
        const users = [generateUser(), generateUser()];
        const result = await request(app)
            .post("/receive-batch")
            .send({
                info: userInfo,
                cursor: 0,
                data: users,
            })
            .accept("text/plain")
            .expect(200);

        expect(result.status).toBe(200);
        expect(result.body).toEqual({ result: "ok" });
    });

    it("When an invalid batch payload is sent, Then it fails", async () => {
        const result = await request(app)
            .post("/receive-batch")
            .send({
                info: userInfo,
                cursor: 0,
                data: generateUser(),
            })
            .accept("text/plain")
            .expect(500);

        expect(result.status).toBe(500);
        expect(result.body).toEqual({
            result: "failure",
            error: "The supplied payload batch was invalid",
        });
    });
});
