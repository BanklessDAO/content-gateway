// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient } from "@cga/prisma";
import { extractLeft, extractRight } from "@shared/util-fp";
import { createSchemaFromType, SchemaInfo } from "@shared/util-schema";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { v4 as uuid } from "uuid";
import { createPrismaDataStorage, createPrismaSchemaStorage } from ".";

@AdditionalProperties(false)
class Address {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
}

const addressInfo = {
    namespace: "test",
    name: "Address",
    version: "V1",
};

const client = new PrismaClient();

describe("Given a Prisma data storage", () => {
    const schemaStorage = createPrismaSchemaStorage(client);
    const storage = createPrismaDataStorage(client, schemaStorage);
    const schema = extractRight(createSchemaFromType(addressInfo, Address));

    const prepareTempSchema = async (version: string) => {
        const tempSchema = {
            ...schema,
            info: {
                ...addressInfo,
                version: version,
            },
        };
        await client.schema.create({
            data: {
                ...{
                    ...tempSchema.info,
                },
                jsonSchema: tempSchema.jsonSchema,
            },
        });
        return tempSchema;
    };

    const prepareAddresses = async (info: SchemaInfo, ids: string[]) => {
        const result = [];
        for (const id of ids) {
            const address = {
                info: info,
                data: {
                    id: id,
                    name: `Some Street ${id}`,
                },
            };
            await storage.store(address)();
            result.push(address);
        }
        return result;
    };

    describe("When creating a new data entry", () => {
        it("Then it is successfully created when valid", async () => {
            const version = uuid();
            const id = uuid();
            const tempSchema = await prepareTempSchema(version);

            const result = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    data: {
                        id: id,
                        name: "Some Street 2",
                    },
                })()
            );
            expect(result).toEqual(id);
        });

        it("Then it fails when id is missing", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);

            const result = extractLeft(
                await storage.store({
                    info: tempSchema.info,
                    data: {
                        name: "Some Street 2",
                    },
                })()
            );

            expect(result).toEqual([
                {
                    field: "",
                    message: "must have required property 'id'",
                },
            ]);
        });

        it("Then it fails when name is missing", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);

            const result = extractLeft(
                await storage.store({
                    info: tempSchema.info,
                    data: {
                        id: uuid(),
                    },
                })()
            );

            expect(result).toEqual([
                {
                    field: "",
                    message: "must have required property 'name'",
                },
            ]);
        });
    });

    describe("When querying a data entry by its id", () => {
        it("Then it is found when there is an entry with the given id", async () => {
            const version = uuid();
            const a0id = uuid();
            const a1id = uuid();
            const tempSchema = await prepareTempSchema(version);
            await prepareAddresses(tempSchema.info, [a0id, a1id]);

            const result = await storage.findById(a0id)();

            expect(result).toEqual(
                O.some({
                    data: {
                        id: a0id,
                        name: `Some Street ${a0id}`,
                    },
                    info: tempSchema.info,
                })
            );
        });

        it("Then it is not found when there isn't an entry with the given id", async () => {
            const result = await storage.findById(uuid())();
            expect(result).toEqual(O.none);
        });
    });

    describe("When querying data by its schema info", () => {
        it("Then when there is data it is returned", async () => {
            const version = uuid();
            const a0id = uuid();
            const a1id = uuid();
            const tempSchema = await prepareTempSchema(version);
            const addresses = await prepareAddresses(tempSchema.info, [
                a0id,
                a1id,
            ]);

            const result = await storage.findBySchema(tempSchema.info)();

            expect(result).toEqual(O.some(addresses));
        });

        it("Then when there is no data, an empty array is returned", async () => {
            const result = await storage.findBySchema(addressInfo)();

            expect(result).toEqual(O.some([]));
        });
    });

    beforeAll(async () => {
        await client.data.deleteMany({});
        await client.schema.deleteMany({});
    });
});
