// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient } from "@cga/prisma";
import {
    DataValidationError,
    Entry,
    FilterType,
} from "@domain/feature-gateway";
import { extractLeft, extractRight } from "@shared/util-fp";
import { createSchemaFromType, SchemaInfo } from "@shared/util-schema";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as O from "fp-ts/lib/Option";
import { v4 as uuid } from "uuid";
import { createPrismaDataRepository, createPrismaSchemaRepository } from ".";

@AdditionalProperties(false)
class Address {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
    @Required(true)
    num: number;
}

const addressInfo = {
    namespace: "test",
    name: "Address",
    version: "V1",
};

const prisma = new PrismaClient({
    // log: ["query"],
});

describe("Given a Prisma data storage", () => {
    const schemaRepository = createPrismaSchemaRepository(prisma);
    const storage = createPrismaDataRepository(prisma, schemaRepository);
    const schema = extractRight(createSchemaFromType(addressInfo, Address));

    const prepareTempSchema = async (version: string) => {
        const tempSchema = {
            ...schema,
            info: {
                ...addressInfo,
                version: version,
            },
        };
        await prisma.schema.create({
            data: {
                ...{
                    ...tempSchema.info,
                },
                jsonSchema: tempSchema.jsonSchema,
            },
        });
        return tempSchema;
    };

    const prepareAddresses = async (info: SchemaInfo, count: number) => {
        const result = [] as Entry[];
        for (let i = 0; i < count; i++) {
            const address = {
                info: info,
                record: {
                    id: uuid(),
                    name: `Some Street ${i}`,
                    num: i,
                },
            };
            const data = extractRight(await storage.store(address)());
            result.push(data);
        }
        return result;
    };

    describe("When querying a data entry by its id", () => {
        it("Then it is found when there is an entry with the given id", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);
            const address = {
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: `Some Street`,
                    num: 1,
                },
            };
            const data = extractRight(await storage.store(address)());

            const result = await storage.findById(data.id)();

            expect(result).toEqual(O.some(data));
        });

        it("Then it is not found when there isn't an entry with the given id", async () => {
            const result = await storage.findById(BigInt(2))();
            expect(result).toEqual(O.none);
        });
    });

    describe("When creating a new data entry", () => {
        it("Then it is successfully created when valid", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);
            const item = {
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Some Street 2",
                    num: 1,
                },
            };

            const data = extractRight(await storage.store(item)());

            const result = extractRight(
                await storage.findBySchema({
                    limit: 2,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    id: data.id,
                    record: data.record,
                },
            ]);
        });

        it("Then it fails when id is missing", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);

            const result = extractLeft(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        name: "Some Street 2",
                        num: 1,
                    },
                })()
            ) as DataValidationError;

            expect(result.errors).toEqual([
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
                    record: {
                        id: uuid(),
                        num: 1,
                    },
                })()
            ) as DataValidationError;

            expect(result.errors).toEqual([
                {
                    field: "",
                    message: "must have required property 'name'",
                },
            ]);
        });
    });

    describe("When creating multiple data entries", () => {
        it("Then it is successfully created when valid", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);
            const records = [
                {
                    id: uuid(),
                    name: "Some Street 2",
                    num: 1,
                },
                {
                    id: uuid(),
                    name: "Some Street 2",
                    num: 3,
                },
            ];

            await storage.storeBulk({
                info: tempSchema.info,
                records: records,
            })();

            const result = extractRight(
                await storage.findBySchema({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries.map((e) => e.record)).toEqual(records);
        });

        it("Then it overwrites old entries", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);
            const info = tempSchema.info;
            const duplicate = {
                info: info,
                record: {
                    id: uuid(),
                    name: "Some Street 2",
                    num: 1,
                },
            };
            await storage.store(duplicate)();

            const records = [
                {
                    ...duplicate.record,
                    name: "New Street 2",
                },
                {
                    id: uuid(),
                    name: "Some Street 2",
                    num: 3,
                },
            ];

            await storage.storeBulk({
                info: info,
                records: records,
            })();

            const result = extractRight(
                await storage.findBySchema({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries.map((e) => e.record)).toEqual(records);
        });
    });

    describe("When querying data by its schema info", () => {
        it("Then when there is data it is returned using cursor", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);
            const addresses = await prepareAddresses(tempSchema.info, 2);

            const result = extractRight(
                await storage.findBySchema({
                    cursor: addresses[0].id,
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    id: addresses[1].id,
                    record: addresses[1].record,
                },
            ]);
        });

        it("Then when there is data it is returned without cursor", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);
            const addresses = await prepareAddresses(tempSchema.info, 2);

            const result = extractRight(
                await storage.findBySchema({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual(
                addresses.map((a) => ({
                    id: a.id,
                    record: a.record,
                }))
            );
        });

        it("Then when there is no data, an empty array is returned", async () => {
            const tempSchema = await prepareTempSchema(uuid());
            const result = extractRight(
                await storage.findBySchema({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([]);
        });
    });

    describe("When querying data by filters", () => {
        it("Then it works without operators", async () => {
            const tempSchema = await prepareTempSchema(uuid());
            const first = await prepareAddresses(tempSchema.info, 2);

            const addresses = await prepareAddresses(tempSchema.info, 2);

            const result = extractRight(
                await storage.findByQuery({
                    cursor: first[1].id,
                    limit: 2,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual(
                addresses.map((a) => ({
                    id: a.id,
                    record: a.record,
                }))
            );
        });

        it("Then it works with the contains operator", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        name: "Hello World A",
                        num: 1,
                    },
                })()
            );
            const data1 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        name: "Hello World B",
                        num: 1,
                    },
                })()
            );

            const result = extractRight(
                await storage.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: ["name"],
                            type: FilterType.contains,
                            value: "World",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            const expected = [data0, data1].map((d) => ({
                id: d.id,
                record: d.record,
            }));

            expect(result.entries).toEqual(expected);
        });

        it("Then it works with the greater than or equal operator", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        name: "Hello World A",
                        num: 3,
                    },
                })()
            );
            await storage.store({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World B",
                    num: 1,
                },
            })();

            const result = extractRight(
                await storage.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: ["num"],
                            type: FilterType.gte,
                            value: 2,
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with the less than or equal operator", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        name: "Hello World A",
                        num: 1,
                    },
                })()
            );
            await storage.store({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World B",
                    num: 3,
                },
            })();

            const result = extractRight(
                await storage.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: ["num"],
                            type: FilterType.lte,
                            value: 2,
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with the equals operator", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const id0 = uuid();
            const id1 = uuid();

            const data0 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: id0,
                        name: "Hello World A",
                        num: 1,
                    },
                })()
            );

            await storage.store({
                info: tempSchema.info,
                record: {
                    id: id1,
                    name: "Hello World B",
                    num: 1,
                },
            })();

            const result = extractRight(
                await storage.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: ["id"],
                            type: FilterType.equals,
                            value: id0,
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with two operators when there is a result", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const id0 = uuid();
            const id1 = uuid();

            const data0 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: id0,
                        name: "Hello World A",
                        num: 1,
                    },
                })()
            );
            await storage.store({
                info: tempSchema.info,
                record: {
                    id: id1,
                    name: "Hello World B",
                    num: 1,
                },
            })();

            const result = extractRight(
                await storage.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: ["id"],
                            type: FilterType.equals,
                            value: id0,
                        },
                        {
                            fieldPath: ["name"],
                            type: FilterType.contains,
                            value: "World",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with two operators when there is no match", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const id0 = uuid();
            const id1 = uuid();

            await storage.store({
                info: tempSchema.info,
                record: {
                    id: id0,
                    name: "Hello World A",
                    num: 1,
                },
            })();

            await storage.store({
                info: tempSchema.info,
                record: {
                    id: id1,
                    name: "Hello World B",
                    num: 1,
                },
            })();

            const result = extractRight(
                await storage.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: ["id"],
                            type: FilterType.equals,
                            value: id0,
                        },
                        {
                            fieldPath: ["name"],
                            type: FilterType.contains,
                            value: "Wombat",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([]);
        });

        it("Then it works with both cursor and operator", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        name: "Hello World A",
                        num: 1,
                    },
                })()
            );
            const data1 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        name: "Hello World B",
                        num: 1,
                    },
                })()
            );

            const result = extractRight(
                await storage.findByQuery({
                    cursor: data0.id,
                    limit: 2,
                    where: [
                        {
                            fieldPath: ["name"],
                            type: FilterType.contains,
                            value: "World",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    id: data1.id,
                    record: data1.record,
                },
            ]);
        });

        it("Test", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = extractRight(
                await storage.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        name: "ok",
                        num: 4,
                    },
                })()
            );
            

            const result = await prisma.data.findMany({
                where: {
                    data: {
                        path: ["num"],
                        not: 1,
                    }
                }
            });
        });
    });

    beforeAll(async () => {
        await prisma.data.deleteMany({});
        await prisma.schema.deleteMany({});
    });

    afterAll(async () => {
        await prisma.data.deleteMany({});
        await prisma.schema.deleteMany({});
    });
});
