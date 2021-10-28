// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient } from "@cga/prisma";
import {
    createDefaultJSONSerializer,
    createSchemaFromObject,
    createSchemaFromType,
    Schema,
    schemaInfoToString,
} from "@shared/util-schema";
import { Required } from "@tsed/schema";
import * as E from "fp-ts/lib/Either";
import { createPrismaSchemaStorage } from "./PrismaSchemaStorage";

class User {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
}

const userInfo = {
    namespace: "test",
    name: "User",
    version: "V1",
};

const client = new PrismaClient();
const serializer = createDefaultJSONSerializer();

describe("Given a Prisma schema storage", () => {
    const userSchema = (
        createSchemaFromType(serializer)(userInfo, User) as E.Right<Schema>
    ).right;

    const storage = createPrismaSchemaStorage(
        (info, schema) => createSchemaFromObject(serializer)(info, schema),
        client
    );

    beforeEach(async () => {
        await client.data.deleteMany({});
        await client.schema.deleteMany({});
    });

    describe("When creating a new schema entry", () => {
        it("Then it is successfully created when valid", async () => {
            const result = await storage.register(userSchema)();

            expect(result).toEqual(E.right(undefined));
        });

        it("Then it fails when the schema already exists", async () => {
            await storage.register(userSchema)();

            const result = await storage.register(userSchema)();

            const info = schemaInfoToString(userInfo);

            expect(result).toEqual(
                E.left(
                    new Error(
                        `There is an incompatible registered schema with key ${info}`
                    )
                )
            );
        });
    });
});
