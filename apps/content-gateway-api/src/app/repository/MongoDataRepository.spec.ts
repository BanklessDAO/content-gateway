// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { GenericProgramError } from "@banklessdao/util-data";
import {
    extractLeft,
    extractRight,
    programError,
} from "@banklessdao/util-misc";
import {
    createSchemaFromClass,
    Data,
    Nested,
    NonEmptyProperty,
    OptionalObjectRef,
    SchemaInfo,
    schemaInfoToString,
} from "@banklessdao/util-schema";
import {
    ContentGatewayUser,
    DataRepository,
    Entry,
    FilterType,
    SchemaRepository,
    SchemaValidationError,
    SinglePayload,
    UserRepository,
} from "@domain/feature-gateway";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { Collection, Db, MongoClient } from "mongodb";
import { v4 as uuid } from "uuid";
import {
    createMongoDataRepository,
    createMongoSchemaRepository,
    createMongoUserRepository,
    DocumentData,
} from ".";
import { MongoUser } from "./mongo/MongoUser";

const addressInfo = {
    namespace: "test",
    name: "Address",
    version: "V1",
};

@Nested()
class Zip {
    @NonEmptyProperty()
    num: number;
}

@Data({
    info: addressInfo,
})
class Address {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name: string;
    @NonEmptyProperty()
    num: number;
    @OptionalObjectRef(Zip)
    zip?: Zip;
}

const url =
    process.env.CG_MONGO_URL ?? programError("CG_MONGO_URL is missing");
const dbName =
    process.env.CG_MONGO_USER ?? programError("CG_MONGO_USER is missing");

describe("Given a Mongo data storage", () => {
    let target: DataRepository;
    let mongoClient: MongoClient;
    let db: Db;
    let schemaRepository: SchemaRepository;
    let userRepository: UserRepository;
    let users: Collection<MongoUser>;
    let user: ContentGatewayUser;

    const collName = uuid();
    const usersCollName = uuid();

    beforeAll(async () => {
        mongoClient = new MongoClient(url);
        await mongoClient.connect();

        db = mongoClient.db(dbName);
        users = await db.createCollection<MongoUser>(usersCollName);
        userRepository = await createMongoUserRepository({
            db,
            usersCollectionName: usersCollName,
        });
        user = extractRight(
            await userRepository.createUser("Arnold", ["terminator"])()
        );
        schemaRepository = await createMongoSchemaRepository({
            db,
            schemasCollectionName: collName,
            usersCollectionName: usersCollName,
        });

        target = createMongoDataRepository({
            db,
            schemaRepository,
        });
    });

    afterAll(async () => {
        await db.dropCollection(collName);
        const schemas = await schemaRepository.findAll()();
        await Promise.all(schemas.map(schemaRepository.remove));
        await users.drop();
        await mongoClient.close();
    });

    const schema = extractRight(createSchemaFromClass(Address));

    const prepareRandomSchema = async (version: string) => {
        const info = {
            ...addressInfo,
            version: version,
        };
        const result = {
            ...schema,
            info: info,
        };

        await schemaRepository.register(result, user)();
        return result;
    };

    const randomInfo = () => ({
        namespace: uuid(),
        name: uuid(),
        version: uuid(),
    });

    const storeRecord = async (payload: SinglePayload): Promise<Entry> => {
        const result = await target.store({
            info: payload.info,
            records: [payload.record],
        })();
        if (E.isLeft(result)) {
            throw result.left;
        }
        const { info, record } = payload;
        const coll = db.collection<DocumentData>(schemaInfoToString(info));
        const entry =
            (await coll.findOne({ id: record.id as string })) ??
            programError("Data not found");
        return {
            id: entry.id,
            record: entry.data,
        };
    };

    const prepareRandomAddresses = async (info: SchemaInfo, count: number) => {
        const result = [] as Entry[];
        for (let i = 0; i < count; i++) {
            const id = uuid();
            const address = {
                info: info,
                record: {
                    id: id,
                    name: `Some Street ${i}`,
                    num: i,
                    zip: {
                        num: Math.round(Math.random() * 100),
                    },
                },
            };
            result.push(await storeRecord(address));
        }
        return result;
    };

    describe("When querying a data entry by its id", () => {
        it("Then it is found when there is an entry with the given id", async () => {
            const version = uuid();
            const tempSchema = await prepareRandomSchema(version);
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
            const tempSchema = await prepareRandomSchema(version);
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
                    id: data.id,
                    record: data.record,
                },
            ]);
        });

        it("Then it fails when id is missing", async () => {
            const version = uuid();
            const tempSchema = await prepareRandomSchema(version);

            const result = extractLeft(
                await target.store({
                    info: tempSchema.info,
                    records: [
                        {
                            name: "Some Street 2",
                            num: 1,
                        },
                    ],
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
            const tempSchema = await prepareRandomSchema(version);

            const result = extractLeft(
                await target.store({
                    info: tempSchema.info,
                    records: [
                        {
                            id: uuid(),
                            num: 1,
                        },
                    ],
                })()
            ) as SchemaValidationError;

            expect(result).toEqual(
                new GenericProgramError({
                    _tag: "SchemaValidationError",
                    message: `Schema validation failed`,
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
            const tempSchema = await prepareRandomSchema(version);

            const record0 = {
                id: uuid(),
                name: "Some Street 2",
                num: 1,
            };

            const record1 = {
                id: uuid(),
                name: "Some Street 2",
                num: 3,
            };

            const data0 = await storeRecord({
                info: tempSchema.info,
                record: record0,
            });

            const data1 = await storeRecord({
                info: tempSchema.info,
                record: record1,
            });

            const result = extractRight(
                await target.findByQuery({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries.map((e) => e.id)).toEqual([
                data0.id,
                data1.id,
            ]);
        });

        it("Then it overwrites old entries", async () => {
            const version = uuid();
            const tempSchema = await prepareRandomSchema(version);
            const info = tempSchema.info;
            const oldRecord = {
                id: uuid(),
                name: "Some Street 2",
                num: 1,
            };
            await target.store({
                info,
                records: [oldRecord],
            })();

            const newRecordsWithDuplicate = [
                {
                    ...oldRecord,
                    name: "New Street 2",
                },
                {
                    id: uuid(),
                    name: "Some Street 2",
                    num: 3,
                },
            ];

            await target.store({
                info: info,
                records: newRecordsWithDuplicate,
            })();

            const result = extractRight(
                await target.findByQuery({
                    limit: 10,
                    info: tempSchema.info,
                })()
            );

            expect(result.entries.map((e) => e.record)).toEqual(
                newRecordsWithDuplicate
            );
        });
    });

    describe("When querying data by its schema info", () => {
        it("Then when there is data it is returned using cursor", async () => {
            const version = uuid();
            const tempSchema = await prepareRandomSchema(version);
            const addresses = await prepareRandomAddresses(tempSchema.info, 2);

            const first = extractRight(
                await target.findByQuery({
                    limit: 1,
                    info: tempSchema.info,
                })()
            );

            const result = extractRight(
                await target.findByQuery({
                    limit: 1,
                    info: tempSchema.info,
                    cursor: first.nextPageToken,
                })()
            );

            expect(result.entries).toEqual([addresses[1]]);
        });

        it("Then when there is data it is returned without cursor", async () => {
            const version = uuid();
            const tempSchema = await prepareRandomSchema(version);
            const addresses = await prepareRandomAddresses(tempSchema.info, 2);

            const result = extractRight(
                await target.findByQuery({
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
            const tempSchema = await prepareRandomSchema(uuid());
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
        it("Then it works with the contains filter", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

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
                id: d.id,
                record: d.record,
            }));

            expect(result.entries).toEqual(expected);
        });

        it("Then it works with the greater than or equal filter", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

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
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with the less than or equal filter", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

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
                records: [
                    {
                        id: uuid(),
                        name: "Hello World B",
                        num: 3,
                    },
                ],
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
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with the equals filter", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

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
                records: [
                    {
                        id: id1,
                        name: "Hello World B",
                        num: 1,
                    },
                ],
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
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with two filters when there is a result", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

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
                records: [
                    {
                        id: id1,
                        name: "Hello World B",
                        num: 1,
                    },
                ],
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
                    id: data0.id,
                    record: data0.record,
                },
            ]);
        });

        it("Then it works with two filters when there is no match", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

            const id0 = uuid();
            const id1 = uuid();

            await target.store({
                info: tempSchema.info,
                records: [
                    {
                        id: id0,
                        name: "Hello World A",
                        num: 1,
                    },
                ],
            })();

            await target.store({
                info: tempSchema.info,
                records: [
                    {
                        id: id1,
                        name: "Hello World B",
                        num: 1,
                    },
                ],
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
            const tempSchema = await prepareRandomSchema(uuid());

            await storeRecord({
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

            const first = extractRight(
                await target.findByQuery({
                    limit: 1,
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

            const result = extractRight(
                await target.findByQuery({
                    cursor: first.nextPageToken,
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

            expect(result.entries).toEqual([data1]);
        });

        it("Then it works with ordering and filtering", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Joe",
                    num: 27,
                    zip: {
                        num: 27,
                    },
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Jane",
                    num: 18,
                    zip: {
                        num: 18,
                    },
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Frank",
                    num: 54,
                    zip: {
                        num: 54,
                    },
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Edith",
                    num: 45,
                    zip: {
                        num: 45,
                    },
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
                        fieldPath: "zip.num",
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
            const tempSchema = await prepareRandomSchema(uuid());

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Joe",
                    num: 27,
                    zip: {
                        num: 27,
                    },
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Jane",
                    num: 18,
                    zip: {
                        num: 18,
                    },
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "Frank",
                    num: 54,
                    zip: {
                        num: 54,
                    },
                },
            });

            await storeRecord({
                info: tempSchema.info,
                record: {
                    id: uuid(),
                    name: "User Edith",
                    num: 45,
                    zip: {
                        num: 45,
                    },
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
                        fieldPath: "zip.num",
                        direction: "asc",
                    },
                    info: tempSchema.info,
                })()
            );

            const result = extractRight(
                await target.findByQuery({
                    limit: 2,
                    cursor: first.nextPageToken,
                    where: [
                        {
                            fieldPath: "name",
                            type: FilterType.starts_with,
                            value: "User",
                        },
                    ],
                    orderBy: {
                        fieldPath: "zip.num",
                        direction: "asc",
                    },
                    info: tempSchema.info,
                })()
            );

            expect(result.entries.map((r) => r.record.num)).toEqual([45]);
        });

        //* This is a regression that happened because we tried to
        //* 👇 order by `data._id` by default (which doesn't exist)
        it("Then it returns the records in same order with different limits", async () => {
            const tempSchema = await prepareRandomSchema(uuid());

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
                    info: tempSchema.info,
                })()
            );

            const second = extractRight(
                await target.findByQuery({
                    limit: 4,
                    info: tempSchema.info,
                })()
            );

            expect(first.entries.map((e) => e.id)).toEqual([
                second.entries[0].id,
                second.entries[1].id,
            ]);
        });
    });
});
