// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient } from "@cga/prisma";
import { extractRight } from "@shared/util-fp";
import {
    createSchemaFromType,
    Schema,
    schemaInfoToString
} from "@shared/util-schema";
import { Type } from "@tsed/core";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { v4 as uuid } from "uuid";
import { createPrismaSchemaRepository } from "./PrismaSchemaRepository";

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

const client = new PrismaClient();

describe("Given a Prisma schema storage", () => {
    const storage = createPrismaSchemaRepository(client);

    describe("When creating a new schema entry", () => {
        it("Then it is successfully created when valid", async () => {
            const version = uuid();

            const result = await storage.register(
                createSchema(User, version)
            )();

            expect(result).toEqual(E.right(undefined));
        });

        it("Then it fails when it is incompatible with an existing schema with the same info", async () => {
            const version = uuid();
            const oldSchema = createSchema(User, version);
            const newSchema = createSchema(IncompatibleUser, version);

            await storage.register(oldSchema)();

            const result = await storage.register(newSchema)();

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

            await storage.register(userSchema)();

            const result = await storage.register(compatibleSchema)();

            expect(result).toEqual(E.right(undefined));
        });

        it("Then it returns the proper schema When we try to find it", async () => {
            const version = uuid();
            const schema = createSchema(User, version);
            await storage.register(schema)();

            const result = (
                (await storage.find(schema.info)()) as O.Some<Schema>
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

    describe("When creating multiple schema entries", () => {
        it("Then they are all returned when trying to find them", async () => {
            const version0 = uuid();
            const version1 = uuid();

            await storage.register(createSchema(User, version0))();
            await storage.register(createSchema(User, version1))();

            const result = await storage.findAll()();

            // expect(result).toEqual(E.right(undefined));
        });
    });
});
