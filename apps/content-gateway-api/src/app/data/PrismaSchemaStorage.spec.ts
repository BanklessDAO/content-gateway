// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient } from "@cga/prisma";
import { extractRight } from "@shared/util-fp";
import {
    createSchemaFromType,
    Schema,
    schemaInfoToString,
} from "@shared/util-schema";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { v4 as uuid } from "uuid";
import { createPrismaSchemaStorage } from "./PrismaSchemaStorage";

@AdditionalProperties(false)
class User {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
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

const createSchema = (version: string) => {
    return extractRight(
        createSchemaFromType(
            {
                ...userInfo,
                version,
            },
            User
        )
    );
};

const createIncompatibleSchema = (version: string) => {
    return extractRight(
        createSchemaFromType(
            {
                ...userInfo,
                version,
            },
            User
        )
    );
};

const client = new PrismaClient();

describe("Given a Prisma schema storage", () => {
    const storage = createPrismaSchemaStorage(client);

    describe("When creating a new schema entry", () => {
        it("Then it is successfully created when valid", async () => {
            const version = uuid();

            const result = await storage.register(createSchema(version))();

            expect(result).toEqual(E.right(undefined));
        });

        it("Then it fails when it is incompatible with an existing schema with the same info", async () => {
            const version = uuid();
            const oldSchema = createSchema(version);
            const newSchema = createIncompatibleSchema(version);

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

        // it("Then it succeeds when it is backward compatible with an existing schema with the same info", async () => {
        //     const version = uuid();
        //     const userSchema = createSchema(version);

        //     await storage.register(userSchema)();

        //     const result = await storage.register(userSchema)();

        //     const info = schemaInfoToString({ ...userInfo, version: version });

        //     expect(result).toEqual(
        //         E.right(undefined)
        //     );
        // });

        it("Then it returns the proper schema When we try to find it", async () => {
            const version = uuid();
            const schema = createSchema(version);
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

            await storage.register(createSchema(version0))();
            await storage.register(createSchema(version1))();

            const result = await storage.findAll()();

            // expect(result).toEqual(E.right(undefined));
        });
    });
});
