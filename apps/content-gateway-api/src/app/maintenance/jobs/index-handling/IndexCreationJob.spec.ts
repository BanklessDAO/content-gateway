import { programError } from "@banklessdao/util-misc";
import * as E from "fp-ts/Either";
import { Db, MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
    AtlasApiInfo,
    IndexSuggestions,
    _addIndexes,
    _queryIndexSuggestions
} from "./IndexCreationJob";

describe("IndexCreationJob", () => {

    it("todo", () => {
        expect(true).toBe(true);
    })
    // describe("_queryIndexSuggestions", () => {
    //     const atlasApiInfo: AtlasApiInfo = {
    //         publicKey:
    //             process.env.ATLAS_PUBLIC_KEY ??
    //             programError("ATLAS_PUBLIC_KEY is missing"),
    //         privateKey:
    //             process.env.ATLAS_PRIVATE_KEY ??
    //             programError("ATLAS_PRIVATE_KEY is missing"),
    //         projectId:
    //             process.env.ATLAS_PROJECT_ID ??
    //             programError("ATLAS_PROJECT_ID is missing"),
    //         processId:
    //             process.env.ATLAS_PROCESS_ID ??
    //             programError("ATLAS_PROCESS_ID is missing"),
    //     };
    //     it("should successfully access the endpoint", async () => {
    //         expect.assertions(1);
    //         return _queryIndexSuggestions(atlasApiInfo)().then((response) => {
    //             expect(E.isRight(response)).toBeTruthy();
    //         });
    //     });
    // });
    // describe("_addIndexes", () => {
    //     let con: MongoClient;
    //     let mongoServer: MongoMemoryServer;
    //     let db: Db;

    //     beforeAll(async () => {
    //         mongoServer = await MongoMemoryServer.create();
    //         con = await MongoClient.connect(mongoServer.getUri(), {});
    //         db = con.db(mongoServer.instanceInfo?.dbName);
    //     });

    //     afterAll(async () => {
    //         if (con) {
    //             await con.close();
    //         }
    //         if (mongoServer) {
    //             await mongoServer.stop();
    //         }
    //     });

    //     it("should add the specified index", async () => {
    //         const namespace = "test1";
    //         const col = db.collection(namespace);
    //         await col.insertMany([{ a: 1 }, { a: 2 }]);

    //         const indexAdder = _addIndexes(db);
    //         const indexSuggestions: IndexSuggestions = makeSuggestedIndex(
    //             [{ a: 1 }],
    //             namespace
    //         );
    //         const result = await indexAdder(indexSuggestions)();
    //         expect(E.isRight(result)).toBeTruthy();
    //         const indexes = await col.indexes();
    //         expect(
    //             indexes.find((i) => {
    //                 return i.key?.a === 1;
    //             })
    //         ).toBeDefined();
    //     });
    //     it("should add multi-field indexes", async () => {
    //         const namespace = "test2";
    //         const col = db.collection(namespace);
    //         await col.insertMany([
    //             { a: 1, b: 1 },
    //             { a: 2, b: 2 },
    //         ]);

    //         const indexAdder = _addIndexes(db);
    //         const indexSuggestions: IndexSuggestions = makeSuggestedIndex(
    //             [{ a: 1 }, { b: -1 }],
    //             namespace
    //         );
    //         const result = await indexAdder(indexSuggestions)();
    //         expect(E.isRight(result)).toBeTruthy();
    //         const indexes = await col.indexes();
    //         expect(
    //             indexes.find((i) => {
    //                 return i.key?.a === 1;
    //             })
    //         ).toBeDefined();
    //         expect(
    //             indexes.find((i) => {
    //                 return i.key?.b === -1;
    //             })
    //         ).toBeDefined();
    //     });
    //     it("should work with the suggestedIndexes example response", async () => {
    //         const namespaceUsers = "test.users";
    //         const colUsers = db.collection(namespaceUsers);
    //         await colUsers.insertMany([
    //             { emails: "test@hoogle.com" },
    //             { emails: "tester@hoogle.com" },
    //         ]);

    //         const namespaceInventory = "test.inventory";
    //         const colInventory = db.collection(namespaceInventory);
    //         await colInventory.insertMany([
    //             { emails: "test@hoogle.com" },
    //             { emails: "tester@hoogle.com" },
    //         ]);

    //         const indexAdder = _addIndexes(db);
    //         const result = await indexAdder(exampleResponse)();

    //         expect(E.isRight(result)).toBeTruthy();
    //         const indexesUsers = await colUsers.indexes();
    //         expect(
    //             indexesUsers.find((i) => {
    //                 return i.key?.emails === 1;
    //             })
    //         ).toBeDefined();

    //         const indexesInventory = await colInventory.indexes();
    //         expect(
    //             indexesInventory.find((i) => {
    //                 return i.key?.email === 1;
    //             })
    //         ).toBeDefined();
    //     });
    // });
});

type Index = IndexSuggestions["suggestedIndexes"][number]["index"];

const makeSuggestedIndex = (
    index: Index,
    namespace: string
): IndexSuggestions => {
    return {
        shapes: undefined,
        suggestedIndexes: [
            {
                id: "test",
                impact: ["bla"],
                weight: 10,
                index,
                namespace,
            },
        ],
    };
};

// This is the example api response given here:
// https://docs.atlas.mongodb.com/reference/api/pa-suggested-indexes-get-all/
const exampleResponse = {
    shapes: [
        {
            avgMs: 42,
            count: 2,
            id: "5b74689a80eef53f3388897e",
            inefficiencyScore: 50000,
            namespace: "test.users",
            operations: [
                {
                    predicates: [{ find: { emails: "la@sa.kp" } }],
                    raw: '2018-08-15T17:14:11.115+0000 I COMMAND  [conn4576] command test.users appName: "MongoDB Shell" command: find { find: "users", filter: { emails: "la@sa.kp" }, lsid: { id: UUID("1a4e71d3-9b67-4e9c-b078-9fdf3fae9091") }, $clusterTime: { clusterTime: Timestamp(1534353241, 1), signature: { hash: BinData(0, AB91938B7CF7BC87994A2909A98D87F29101EFA0), keyId: 6589681559618453505 } }, $db: "test" } planSummary: COLLSCAN keysExamined:0 docsExamined:50000 cursorExhausted:1 numYields:391 nreturned:1 reslen:339 locks:{ Global: { acquireCount: { r: 784 } }, Database: { acquireCount: { r: 392 } }, Collection: { acquireCount: { r: 392 } } } protocol:op_msg 34ms',
                    stats: {
                        ms: 34,
                        nReturned: 1,
                        nScanned: 50000,
                        ts: 1534353251147,
                    },
                },
                {
                    predicates: [{ find: { emails: "tocde@fijoow.to" } }],
                    raw: '2018-08-15T17:14:18.665+0000 I COMMAND  [conn4576] command test.users appName: "MongoDB Shell" command: find { find: "users", filter: { emails: "tocde@fijoow.to" }, lsid: { id: UUID("1a4e71d3-9b67-4e9c-b078-9fdf3fae9091") }, $clusterTime: { clusterTime: Timestamp(1534353241, 1), signature: { hash: BinData(0, AB91938B7CF7BC87994A2909A98D87F29101EFA0), keyId: 6589681559618453505 } }, $db: "test" } planSummary: COLLSCAN keysExamined:0 docsExamined:50000 cursorExhausted:1 numYields:390 nreturned:1 reslen:342 locks:{ Global: { acquireCount: { r: 782 } }, Database: { acquireCount: { r: 391 } }, Collection: { acquireCount: { r: 391 } } } protocol:op_msg 36ms',
                    stats: {
                        ms: 36,
                        nReturned: 1,
                        nScanned: 50000,
                        ts: 1534353258697,
                    },
                },
            ],
        },
    ],
    suggestedIndexes: [
        {
            id: "5b74689a80eef53f3388897f",
            impact: ["5b74689a80eef53f3388897e"],
            index: [
                {
                    emails: 1,
                },
            ],
            namespace: "test.users",
            weight: 0.372204809018156,
        },
        {
            id: "5b74689a80eef53f33888980",
            impact: ["5b74689a80eef53f3388897d"],
            index: [
                {
                    email: 1,
                },
            ],
            namespace: "test.inventory",
            weight: 0.190375783099664,
        },
    ],
};
