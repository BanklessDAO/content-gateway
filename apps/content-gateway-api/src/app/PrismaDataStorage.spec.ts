// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { PrismaClient } from "@cga/prisma";
import {
    createDefaultJSONSerializer,
    createSchemaFromObject,
    createSchemaFromType,
    Schema,
} from "@shared/util-schema";
import { Required } from "@tsed/schema";
import * as E from "fp-ts/lib/Either";
import * as O from "fp-ts/lib/Option";
import { v4 as uuid } from "uuid";
import { createPrismaDataStorage } from "./PrismaDataStorage";
import * as RE from "fp-ts/ReaderEither";

class Address {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
}

const info = {
    namespace: "test",
    name: "Address",
    version: "V1",
};

const id = uuid();

const validAddress = {
    info: info,
    data: {
        id: id,
        name: "Some Street 1",
    },
};

const client = new PrismaClient();
const serializer = createDefaultJSONSerializer();

describe("Given a Prisma data storage", () => {
    const schema = (createSchemaFromType(serializer)(
        info,
        Address
    ) as E.Right<Schema>).right;


    const storage = createPrismaDataStorage(
        createSchemaFromObject(serializer),
        client
    );

    const prepareDatabase = async () => {
        await client.data.deleteMany({});
        await client.schema.deleteMany({});
    };

    const prepareUserSchema = async () => {
        await client.schema.create({
            data: {
                ...info,
                schemaObject: schema.schemaObject,
            },
        });
    };

    const prepareAddresses = async () => {
        await storage.store({
            info: info,
            data: validAddress.data,
        })();
        await storage.store({
            info: info,
            data: {
                id: id,
                name: "Some Street 2",
            },
        })();
    };

    beforeEach(async () => {
        await prepareDatabase();
        await prepareUserSchema();
    });

    describe("When creating a new data entry", () => {
        it("Then it is successfully created when valid", async () => {

            const result = await storage.store({
                info: info,
                data: {
                    id: id,
                    name: "Some Street 2",
                },
            })();

            expect(result).toEqual(E.right(id));
        });

        it("Then it fails when id is missing", async () => {
            const result = await storage.store({
                info: info,
                data: {
                    name: "Some Street 2",
                },
            })();

            expect(E.isLeft(result)).toBeTruthy();
        });

        it("Then it fails when name is missing", async () => {
            const result = await storage.store({
                info: info,
                data: {
                    id: uuid(),
                },
            })();

            expect(result).toEqual(
                E.left([
                    {
                        field: "",
                        message: "must have required property 'name'",
                    },
                ])
            );
        });
    });

    describe("When querying a data entry by its id", () => {
        beforeEach(async () => {
            await prepareAddresses();
        });

        it("Then it is found when there is an entry with the given id", async () => {
            const result = await storage.findById(id)();
            expect(result).toEqual(O.some(validAddress));
        });

        it("Then it is not found when there isn't an entry with the given id", async () => {
            const result = await storage.findById(uuid())();
            expect(result).toEqual(O.none);
        });
    });

    describe("When querying data by its schema info", () => {
        
        it("Then when there is data it is returned", async () => {
            await prepareAddresses();
            const result = await storage.findBySchema(info)();

            expect(result).toEqual(O.some([validAddress]));
        });

        it("Then when there is no data, an empty array is returned", async () => {
            const result = await storage.findBySchema(info)();

            expect(result).toEqual(O.some([]));
        });
    });
});
