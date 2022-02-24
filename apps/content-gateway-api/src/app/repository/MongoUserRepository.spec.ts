// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { extractRight, programError } from "@banklessdao/util-misc";
import { UserNotFoundError, UserRepository } from "@domain/feature-gateway";
import * as E from "fp-ts/Either";
import { Collection, Db, MongoClient } from "mongodb";
import { v4 as uuid } from "uuid";
import { createMongoUserRepository } from ".";
import { MongoUser } from "./mongo/MongoUser";

const url =
    process.env.CG_MONGO_URL ?? programError("CG_MONGO_URL is missing");
const dbName =
    process.env.CG_MONGO_USER ?? programError("CG_MONGO_USER is missing");

describe("Given a Mongo user repository", () => {
    let target: UserRepository;
    let mongoClient: MongoClient;
    let db: Db;
    let users: Collection<MongoUser>;

    const collName = uuid();

    beforeAll(async () => {
        mongoClient = new MongoClient(url);
        db = mongoClient.db(dbName);
        users = db.collection<MongoUser>(collName);
        await mongoClient.connect();

        target = await createMongoUserRepository({
            db,
            usersCollectionName: collName,
        });
    });

    afterAll(async () => {
        await users.drop();
        await mongoClient.close();
    });

    describe("When creating a new user", () => {
        it("Then it is successfully created when valid", async () => {
            const expected = {
                name: "test",
                roles: ["admin"],
                apiKeys: [],
            };

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...rest } = extractRight(
                await target.createUser(expected.name, expected.roles)()
            );

            expect(rest).toEqual(expected);
        });

        it("Then it can be found by its id", async () => {
            const user = extractRight(
                await target.createUser("john", ["user"])()
            );

            const result = extractRight(await target.findById(user.id)());

            expect(result).toEqual(user);
        });

        it("And deleting it Then it is gone", async () => {
            const user = extractRight(
                await target.createUser("john", ["user"])()
            );

            await target.deleteUser(user)();

            const result = await target.findById(user.id)();

            expect(result).toEqual(
                E.left(
                    new UserNotFoundError(`Couldn't find user by id ${user.id}`)
                )
            );
        });
    });

    describe("When updating a user", () => {
        it("with a new API key Then it is stored", async () => {
            const user = extractRight(
                await target.createUser("jane", ["user"])()
            );

            user.apiKeys.push({
                id: "id",
                hash: "hash",
            });

            await target.updateUser(user)();

            const result = extractRight(await target.findById(user.id)());

            expect(result).toEqual(user);
        });
    });

    describe("When trying to find by API key id", () => {
        it("The it is found", async () => {
            const id = "id1";

            const user = extractRight(
                await target.createUser("sam", ["user"])()
            );
            user.apiKeys.push({
                id: id,
                hash: "hash1",
            });
            await target.updateUser(user)();

            const result = extractRight(await target.findByApiKeyId(id)());

            expect(result).toEqual(user);
        });
    });
});
