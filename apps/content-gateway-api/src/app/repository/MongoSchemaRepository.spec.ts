// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { SchemaRepository } from "@domain/feature-gateway";
import { extractRight, programError } from "@shared/util-fp";
import {
    createSchemaFromType,
    Schema,
    schemaInfoToString,
} from "@shared/util-schema";
import { Type } from "@tsed/core";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { Db, MongoClient } from "mongodb";
import { v4 as uuid } from "uuid";
import { createMongoSchemaRepository } from ".";

@AdditionalProperties(false)
class User {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
}

@AdditionalProperties(false)
class BackwardsCompatibleUser {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
    @Required(false)
    likesRamen: boolean;
}

@AdditionalProperties(false)
class IncompatibleUser {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
    @Required(true)
    age: number;
}

const userInfo = {
    namespace: "test",
    name: "User",
};

const createSchema = (type: Type<unknown>, version: string) => {
    return extractRight(
        createSchemaFromType(
            {
                ...userInfo,
                version,
            },
            type
        )
    );
};

const url =
    process.env.MONGO_CGA_URL ?? programError("MONGO_CGA_URL is missing");
const dbName =
    process.env.MONGO_CGA_USER ?? programError("MONGO_CGA_USER is missing");

describe("Given a Mongo schema storage", () => {
    let target: SchemaRepository;
    let mongoClient: MongoClient;
    let db: Db;

    beforeAll(async () => {
        mongoClient = new MongoClient(url);
        db = mongoClient.db(dbName);
        await mongoClient.connect();

        target = await createMongoSchemaRepository({
            dbName,
            mongoClient,
        });
    });

    afterAll(async () => {
        await db.dropDatabase();
        await mongoClient.close();
    });

    describe("When creating a new schema entry", () => {
        it("Then it is successfully created when valid", async () => {
            const version = uuid();

            const result = await target.register(createSchema(User, version))();

            expect(result).toEqual(E.right(undefined));
        });

        it("Then it fails when it is incompatible with an existing schema with the same info", async () => {
            const version = uuid();
            const oldSchema = createSchema(User, version);
            const newSchema = createSchema(IncompatibleUser, version);

            await target.register(oldSchema)();

            const result = await target.register(newSchema)();

            const info = schemaInfoToString({ ...userInfo, version: version });

            expect(result).toEqual(
                E.left(
                    new Error(
                        `There is an incompatible registered schema with key ${info}`
                    )
                )
            );
        });

        it("Then it succeeds when it is backward compatible with an existing schema with the same info", async () => {
            const version = uuid();
            const userSchema = createSchema(User, version);
            const compatibleSchema = createSchema(
                BackwardsCompatibleUser,
                version
            );

            await target.register(userSchema)();

            const result = await target.register(compatibleSchema)();

            expect(result).toEqual(E.right(undefined));
        });

        it("Then it returns the proper schema When we try to find it", async () => {
            const version = uuid();
            const schema = createSchema(User, version);
            await target.register(schema)();

            const result = (
                (await target.find(schema.info)()) as O.Some<Schema>
            ).value;
            expect({
                info: result.info,
                jsonSchema: result.jsonSchema,
            }).toEqual({
                info: schema.info,
                jsonSchema: schema.jsonSchema,
            });
        });
    });
});
