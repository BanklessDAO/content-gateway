// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import {
    DataRepository,
    Entry,
    FilterType,
    SchemaValidationError,
    SinglePayload,
} from "@domain/feature-gateway";
import { GenericProgramError } from "@shared/util-dto";
import { extractLeft, extractRight, programError } from "@shared/util-fp";
import {
    createSchemaFromType,
    SchemaInfo,
    schemaInfoToString,
} from "@shared/util-schema";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as O from "fp-ts/lib/Option";
import { Collection, Db, MongoClient } from "mongodb";
import { v4 as uuid } from "uuid";
import {
    createMongoDataRepository,
    createMongoSchemaRepository,
    Data,
    SCHEMAS_COLLECTION_NAME,
} from ".";

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

const url =
    process.env.MONGO_CGA_URL ?? programError("MONGO_CGA_URL is missing");
const dbName =
    process.env.MONGO_CGA_USER ?? programError("MONGO_CGA_USER is missing");

describe("Given a Mongo data storage", () => {
    let target: DataRepository;
    let mongoClient: MongoClient;
    let db: Db;
    let schemas: Collection;

    beforeAll(async () => {
        mongoClient = new MongoClient(url);
        await mongoClient.connect();
        db = mongoClient.db(dbName);
        schemas = db.collection(SCHEMAS_COLLECTION_NAME);

        const schemaRepository = await createMongoSchemaRepository({
            dbName,
            mongoClient,
        });

        target = createMongoDataRepository({
            dbName,
            mongoClient,
            schemaRepository,
        });
    });

    afterAll(async () => {
        await db.dropDatabase();
        await mongoClient.close();
    });

    const schema = extractRight(createSchemaFromType(addressInfo, Address));

    const prepareTempSchema = async (version: string) => {
        const info = {
            ...addressInfo,
            version: version,
        };
        const tempSchema = {
            ...schema,
            info: info,
        };
        await schemas.insertOne({
            key: schemaInfoToString(info),
            jsonSchema: tempSchema.jsonSchema,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return tempSchema;
    };

    const randomInfo = () => ({
        namespace: uuid(),
        name: uuid(),
        version: uuid(),
    });

    const storeRecord = async (payload: SinglePayload): Promise<Entry> => {
        await target.store(payload)();
        const { info, record } = payload;
        const coll = db.collection<Data>(schemaInfoToString(info));
        const entry =
            (await coll.findOne({ id: record.id as string })) ??
            programError("Data not found");
        return {
            _id: entry._id.toString(),
            id: entry.id,
            record: entry.data,
        };
    };

    const prepareAddresses = async (info: SchemaInfo, count: number) => {
        const result = [] as Entry[];
        for (let i = 0; i < count; i++) {
            const id = uuid();
            const address = {
                info: info,
                record: {
                    id: id,
                    name: `Some Street ${i}`,
                    num: i,
                },
            };
            result.push(await storeRecord(address));
        }
        return result;
    };

    describe("When querying a data entry by its id", () => {
        it("Then it is found when there is an entry with the given id", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);
            const info = tempSchema.info;
            const address = {
                info: info,
                record: {
                    id: uuid(),
                    name: `Some Street`,
                    num: 1,
                },
            };
            const data = await storeRecord(address);

            const result = await target.findById(info, data.id)();

            expect(result).toEqual(O.some(data));
        });

        it("Then it is not found when there isn't an entry with the given id", async () => {
            const result = await target.findById(randomInfo(), uuid())();
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

            const data = await storeRecord(item);

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    _id: data._id.toString(),
                    id: data.id,
                    record: data.record,
                },
            ]);
        });

        it("Then it fails when id is missing", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);

            const result = extractLeft(
                await target.store({
                    info: tempSchema.info,
                    record: {
                        name: "Some Street 2",
                        num: 1,
                    },
                })()
            );

            expect(result).toEqual(
                new GenericProgramError({
                    _tag: "SchemaValidationError",
                    message: "Schema validation failed",
                    details: {
                        validationErrors: ["must have required property 'id'"],
                    },
                    cause: undefined,
                })
            );
        });

        it("Then it fails when name is missing", async () => {
            const version = uuid();
            const tempSchema = await prepareTempSchema(version);

            const result = extractLeft(
                await target.store({
                    info: tempSchema.info,
                    record: {
                        id: uuid(),
                        num: 1,
                    },
                })()
            ) as SchemaValidationError;

            expect(result).toEqual(
                new GenericProgramError({
                    _tag: "SchemaValidationError",
                    message: "Schema validation failed",
                    details: {
                        validationErrors: [
                            "must have required property 'name'",
                        ],
                    },
                    cause: undefined,
                })
            );
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

            await target.storeBulk({
                info: tempSchema.info,
                records: records,
            })();

            const result = extractRight(
                await target.findByQuery({
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
            await target.store(duplicate)();

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

            await target.storeBulk({
                info: info,
                records: records,
            })();

            const result = extractRight(
                await target.findByQuery({
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
                await target.findByQuery({
                    cursor: addresses[0]._id,
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    _id: addresses[1]._id.toString(),
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
                await target.findByQuery({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual(
                addresses.map((a) => ({
                    _id: a._id,
                    id: a.id,
                    record: a.record,
                }))
            );
        });

        it("Then when there is no data, an empty array is returned", async () => {
            const tempSchema = await prepareTempSchema(uuid());
            const result = extractRight(
                await target.findByQuery({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([]);
        });
    });

    describe("When querying data by filters", () => {
        it("Then it works without filters", async () => {
            const tempSchema = await prepareTempSchema(uuid());
            const first = await prepareAddresses(tempSchema.info, 2);

            const addresses = await prepareAddresses(tempSchema.info, 2);

            const result = extractRight(
                await target.findByQuery({
                    cursor: first[1]._id,
                    limit: 2,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual(
                addresses.map((a) => ({
                    _id: a._id,
                    id: a.id,
                    record: a.record,
                }))
            );
        });

        it("Then it works with the contains filter", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World A",
                    num: 1,
                },
            });

            const data1 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World B",
                    num: 1,
                },
            });

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: "name",
                            type: FilterType.contains,
                            value: "World",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            const expected = [data0, data1].map((d) => ({
                _id: d._id,
                id: d.id,
                record: d.record,
            }));

            expect(result.entries).toEqual(expected);
        });

        it("Then it works with the greater than or equal filter", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World A",
                    num: 3,
                },
            });
            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World B",
                    num: 1,
                },
            });

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: "num",
                            type: FilterType.gte,
                            value: 2,
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    _id: data0._id,
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with the less than or equal filter", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World A",
                    num: 1,
                },
            });
            await target.store({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World B",
                    num: 3,
                },
            })();

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: "num",
                            type: FilterType.lte,
                            value: 2,
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    _id: data0._id,
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with the equals filter", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const id0 = uuid();
            const id1 = uuid();

            const data0 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: id0,
                    name: "Hello World A",
                    num: 1,
                },
            });

            await target.store({
                info: tempSchema.info,
                record: {
                    id: id1,
                    name: "Hello World B",
                    num: 1,
                },
            })();

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: "id",
                            type: FilterType.equals,
                            value: id0,
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    _id: data0._id,
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with two filters when there is a result", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const id0 = uuid();
            const id1 = uuid();

            const data0 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: id0,
                    name: "Hello World A",
                    num: 1,
                },
            });

            await target.store({
                info: tempSchema.info,
                record: {
                    id: id1,
                    name: "Hello World B",
                    num: 1,
                },
            })();

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: "id",
                            type: FilterType.equals,
                            value: id0,
                        },
                        {
                            fieldPath: "name",
                            type: FilterType.contains,
                            value: "World",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    _id: data0._id,
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with two filters when there is no match", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const id0 = uuid();
            const id1 = uuid();

            await target.store({
                info: tempSchema.info,
                record: {
                    id: id0,
                    name: "Hello World A",
                    num: 1,
                },
            })();

            await target.store({
                info: tempSchema.info,
                record: {
                    id: id1,
                    name: "Hello World B",
                    num: 1,
                },
            })();

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: "id",
                            type: FilterType.equals,
                            value: id0,
                        },
                        {
                            fieldPath: "name",
                            type: FilterType.contains,
                            value: "Wombat",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([]);
        });

        it("Then it works with both cursor and filter", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            const data0 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World A",
                    num: 1,
                },
            });

            const data1 = await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Hello World B",
                    num: 1,
                },
            });

            const result = extractRight(
                await target.findByQuery({
                    cursor: data0._id,
                    limit: 2,
                    where: [
                        {
                            fieldPath: "name",
                            type: FilterType.contains,
                            value: "World",
                        },
                    ],
                    info: tempSchema.info,
                })()
            );

            expect(result.entries).toEqual([
                {
                    _id: data1._id,
                    id: data1.id,
                    record: data1.record,
                },
            ]);
        });

        it("Then it works with ordering and filtering", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Joe",
                    num: 27,
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Jane",
                    num: 18,
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Frank",
                    num: 54,
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Edith",
                    num: 45,
                },
            });

            const result = extractRight(
                await target.findByQuery({
                    limit: 5,
                    where: [
                        {
                            fieldPath: "name",
                            type: FilterType.starts_with,
                            value: "User",
                        },
                    ],
                    orderBy: {
                        fieldPath: "num",
                        direction: "asc",
                    },
                    info: tempSchema.info,
                })()
            );

            expect(result.entries.map((r) => r.record.num)).toEqual([
                18, 27, 45,
            ]);
        });

        it("Then it works with ordering, filtering and cursor", async () => {
            const tempSchema = await prepareTempSchema(uuid());

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Joe",
                    num: 27,
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Jane",
                    num: 18,
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Frank",
                    num: 54,
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Edith",
                    num: 45,
                },
            });

            const first = extractRight(
                await target.findByQuery({
                    limit: 2,
                    where: [
                        {
                            fieldPath: "name",
                            type: FilterType.starts_with,
                            value: "User",
                        },
                    ],
                    orderBy: {
                        fieldPath: "num",
                        direction: "asc",
                    },
                    info: tempSchema.info,
                })()
            );

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    cursor: `${
                        first.entries[first.entries.length - 1].record.num
                    }`,
                    where: [
                        {
                            fieldPath: "name",
                            type: FilterType.starts_with,
                            value: "User",
                        },
                    ],
                    orderBy: {
                        fieldPath: "num",
                        direction: "asc",
                    },
                    info: tempSchema.info,
                })()
            );

            expect(result.entries.map((r) => r.record.num)).toEqual([45]);
        });
    });
});
