/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@banklessdao/content-gateway-client";
import {
    createContentGateway,
    createInMemoryDataStorage,
    createInMemorySchemaStorage
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
import * as g from "graphql";
import { join } from "path";
import Pluralize from "typescript-pluralize";
import * as v from "voca";

const CLIENT_BUILD_PATH = join(__dirname, "../content-gateway-frontend");
const ENVIRONMENT = process.env.NODE_ENV;
const PORT = process.env.PORT || 3333;

const isDev = ENVIRONMENT === "development";
const isProd = ENVIRONMENT === "production";
const isHeroku = ENVIRONMENT === "heroku";

const app = express();

const serializer = createDefaultJSONSerializer();
const deserializeSchema = createSchemaFromString(serializer);
const deserializeSchemaDTO = stringToSchemaDTO(serializer);
const deserializePayloadDTO = stringToPayloadDTO(serializer);
const schemaStorage = createInMemorySchemaStorage();
const dataStorage = createInMemoryDataStorage();
const gateway = createContentGateway(schemaStorage, dataStorage);

const client = createClient(serializer, {
    register: (schema) => {
        const dto = deserializeSchemaDTO(schema);
        return pipe(
            deserializeSchema(dto.info, dto.schema),
            E.mapLeft((err) => new Error(String(err))),
            E.chain(gateway.register)
        );
    },
    send: (payload: string) => {
        const dto = deserializePayloadDTO(payload);
        return gateway.receive(PayloadDTO.toPayload(dto));
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

client.register(postKey, Post);

client.send(postKey, {
    text: "Hello World",
});

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

client.register(userKey, User);

client.send(userKey, {
    id: "1",
    name: "John Doe",
    age: 30,
    city: {
        name: "New York",
        country: "USA",
        population: 8500000,
    },
});

client.send(userKey, {
    id: "2",
    name: "Jane Doe",
    age: 25,
    city: {
        name: "Paris",
        country: "France",
        population: 2000000,
    },
});

type SchemaGQLTypePair = [Schema, g.GraphQLObjectType];

pipe(
    schemaStorage.findAll(),
    A.map((schema) => [schema, toGraphQLType(schema)] as SchemaGQLTypePair),
    A.map(([schema, type]) => {
        const name = schema.info.name;
        return {
            [v.lowerCase(name)]: {
                type: type,
                args: {
                    id: { type: g.GraphQLString },
                },
                resolve: (_, { id }) => {
                    return dataStorage
                        .findBySchema<Record<string, unknown>>(schema.info)
                        .filter((entity) => entity.id === id);
                },
            },
            [v.lowerCase(Pluralize.plural(name))]: {
                type: g.GraphQLList(type),
                resolve: () => {
                    return dataStorage.findBySchema<Record<string, unknown>>(
                        schema.info
                    );
                },
            },
        };
    }),
    A.reduce({} as g.Thunk<g.GraphQLFieldConfigMap<any, any>>, (acc, curr) => ({
        ...acc,
        ...curr,
    })),
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

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.schema.create({
        data: {
            namespace: "test",
            name: "test",
            version: "V1",
            createdAt: new Date(),
            updatedAt: new Date(),
            schemaObject: {}
        }
    });
    console.dir(result, { depth: null });
}

main()
    .catch((e) => {
        throw e;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });