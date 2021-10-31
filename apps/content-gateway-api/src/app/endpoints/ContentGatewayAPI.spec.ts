import {
    ContentGateway,
    createContentGateway,
    createDataStorageStub,
    createSchemaStorageStub,
    DataStorageStub,
    SchemaStorageStub,
} from "@domain/feature-gateway";
import { extractRight } from "@shared/util-fp";
import { createSchemaFromType } from "@shared/util-schema";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as express from "express";
import * as request from "supertest";
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

describe("Given a content gateway api", () => {
    let app: express.Application;
    let gateway: ContentGateway;
    let dataStorageStub: DataStorageStub;
    let schemaStorageStub: SchemaStorageStub;

    beforeEach(async () => {
        app = express();
        dataStorageStub = createDataStorageStub();
        schemaStorageStub = createSchemaStorageStub();
        gateway = createContentGateway(schemaStorageStub, dataStorageStub);
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
            .post("/register")
            .send({
                info: userInfo,
                data: {
                    id: "1",
                    name: "John",
                    address: { id: "1", name: "Home" },
                },
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
            error: "The supplied schema was invalid",
        });
    });
});
