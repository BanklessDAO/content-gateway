/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@banklessdao/content-gateway-client";
import {
    createContentGateway
} from "@domain/feature-gateway";
import { PrismaClient } from "@prisma/client";
import {
    PayloadDTO,
    stringToPayloadDTO,
    stringToSchemaDTO
} from "@shared/util-dto";
import { toGraphQLType } from "@shared/util-graphql";
import {
    createDefaultJSONSerializer,
    createSchemaFromObject,
    createSchemaFromString,
    Schema
} from "@shared/util-schema";
import { Required } from "@tsed/schema";
import * as express from "express";
import { graphqlHTTP } from "express-graphql";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { map } from "fp-ts/lib/Identity";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import * as g from "graphql";
import { join } from "path";
import Pluralize from "typescript-pluralize";
import * as v from "voca";
import { createPrismaDataStorage } from "./app/PrismaDataStorage";
import { createPrismaSchemaStorage } from "./app/PrismaSchemaStorage";

const CLIENT_BUILD_PATH = join(__dirname, "../content-gateway-frontend");
const ENVIRONMENT = process.env.NODE_ENV;
const PORT = process.env.PORT || 3333;

const isDev = ENVIRONMENT === "development";
const isProd = ENVIRONMENT === "production";
const isHeroku = ENVIRONMENT === "heroku";

const app = express();

const serializer = createDefaultJSONSerializer();
const deserializeSchemaFromObject = createSchemaFromObject(serializer);
const deserializeSchemaFromString = createSchemaFromString(serializer);
const deserializeSchemaDTO = stringToSchemaDTO(serializer);
const deserializePayloadDTO = stringToPayloadDTO(serializer);

const prisma = new PrismaClient();

const schemaStorage = createPrismaSchemaStorage(
    deserializeSchemaFromObject,
    prisma
);
const dataStorage = createPrismaDataStorage(deserializeSchemaFromObject, prisma);

// const schemaStorage = createInMemorySchemaStorage();
// const dataStorage = createInMemoryDataStorage();

const gateway = createContentGateway(schemaStorage, dataStorage);

const client = createClient({
    serializer,
    adapter: {
        register: (schema) => {
            const dto = deserializeSchemaDTO(schema);
            return pipe(
                deserializeSchemaFromString(dto.info, dto.schema),
                E.mapLeft((err) => new Error(String(err))),
                TE.fromEither,
                TE.chain(gateway.register)
            );
        },
        send: (payload: string) => {
            const dto = deserializePayloadDTO(payload);
            return pipe(
                gateway.receive(PayloadDTO.toPayload(dto)),
                TE.chain(() => TE.of(undefined))
            );
        },
    },
});

const userKey = {
    namespace: "test",
    name: "User",
    version: "V1",
};

const postKey = {
    namespace: "test",
    name: "Post",
    version: "V1",
};

class Post {
    @Required(true)
    text: string;
}

class City {
    @Required()
    name: string;
    @Required()
    country: string;
    @Required()
    population: number;

    constructor(name: string, country: string, population: number) {
        this.name = name;
        this.country = country;
        this.population = population;
    }
}

class User {
    @Required(true)
    id: string;

    @Required(true)
    name: string;

    @Required(true)
    age: number;

    @Required(true)
    city: City;

    constructor(id: string, name: string, age: number, city: City) {
        this.id = id;
        this.name = name;
        this.age = age;
        this.city = city;
    }
}

type SchemaGQLTypePair = [Schema, g.GraphQLObjectType];

async function prepare() {
    await prisma.data.deleteMany({});
    await prisma.schema.deleteMany({});
    await client.save(postKey, {
        id: "hello-1",
        text: "Hello World",
    })
    await client.register(userKey, User);
    await client.save(userKey, {
        id: "1",
        name: "John Doe",
        age: 30,
        city: {
            name: "New York",
            country: "USA",
            population: 8500000,
        },
    });
    await client.save(userKey, {
        id: "2",
        name: "Jane Doe",
        age: 25,
        city: {
            name: "Paris",
            country: "France",
            population: 2000000,
        },
    });
}

async function createGraphQLAPI() {
    console.log(await schemaStorage.findAll()());
    pipe(
        await schemaStorage.findAll()(),
        O.getOrElse(() => [] as Schema[]),
        A.map(
            (schema: Schema) =>
                [schema, toGraphQLType(schema)] as SchemaGQLTypePair
        ),
        A.map(([schema, type]) => {
            const name = schema.info.name;
            const findById = async (id: string) => {
                return pipe(
                    dataStorage.findBySchema(schema.info),
                    TO.map((data) =>
                        data.filter((entity) => entity.data.id === id)
                    ),
                    TO.map((data) => data.map((entity) => entity.data)),
                    TO.getOrElse(() => T.of([])),
                )();
            };
            const findAll = async () => {
                return pipe(
                    dataStorage.findBySchema(schema.info),
                    TO.map((data) => data.map((entity) => entity.data)),
                    TO.getOrElse(() => T.of([]))
                )();
            };
            return {
                [v.lowerCase(name)]: {
                    type: type,
                    args: {
                        id: { type: g.GraphQLString },
                    },
                    resolve: (_, { id }) => {
                        return findById(id);
                    },
                },
                [v.lowerCase(Pluralize.plural(name))]: {
                    type: g.GraphQLList(type),
                    resolve: () => {
                        return findAll();
                    },
                },
            };
        }),
        A.reduce(
            {} as g.Thunk<g.GraphQLFieldConfigMap<any, any>>,
            (acc, curr) => ({
                ...acc,
                ...curr,
            })
        ),
        map((fields) => {
            const queryType = new g.GraphQLObjectType({
                name: "Query",
                fields: fields,
            });
            return new g.GraphQLSchema({ query: queryType });
        }),
        map((schema) => {
            app.use(express.static(CLIENT_BUILD_PATH));

            app.use(
                "/api/graphql",
                graphqlHTTP({
                    schema: schema,
                    graphiql: isDev || isHeroku,
                })
            );

            if (isProd) {
                app.get("*", (request, response) => {
                    response.sendFile(join(CLIENT_BUILD_PATH, "index.html"));
                });
            }

            const server = app.listen(PORT, () => {
                console.log(`Listening at http://localhost:${PORT}`);
            });
            server.on("error", console.error);
        })
    );
}

async function main() {
    if(isDev) {
        await prepare();
    }
    await createGraphQLAPI();
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });
