import {
    createDefaultJSONSerializer,
    createSchemaFromType,
    Schema
} from "@shared/util-schema";
import { CollectionOf, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import * as g from "graphql";
import { toGraphQLType } from "./converters";

class Comment {
    @Required(true)
    text: string;
}

class City {
    @Required(true)
    name: string;
}

class Address {
    @Required(true)
    address: string;
    @Required(true)
    city: City;
}

class User {
    @Required(true)
    id: string;
    @Required(true)
    name?: string;
    @Required(false)
    @CollectionOf(Comment)
    comments: Comment[];
    @Required(false)
    @CollectionOf(String)
    skills: string[];
    @Required(true)
    address: Address;
}

const userKey = {
    namespace: "test",
    name: "User",
    version: "v1",
};

const expectedSDL = `type Comment {
  text: String
}

type City {
  name: String
}

type Address {
  address: String
  city: City
}

type User {
  id: ID
  name: String
  comments: [Comment]
  skills: [String]
  address: Address
}
`;

describe("Given a JSON schema type", () => {
    const schema = (
        createSchemaFromType(createDefaultJSONSerializer())(
            userKey,
            User
        ) as E.Right<Schema>
    ).right;

    describe("when converting it to a GraphQL schema", () => {
        const types = toGraphQLType(schema);

        it("then it is successfully converted", () => {
            const sdl = g.printSchema(new g.GraphQLSchema({ types: [types] }));
            expect(sdl).toEqual(expectedSDL);
        });
    });
});
