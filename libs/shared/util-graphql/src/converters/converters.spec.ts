import { extractRight } from "@shared/util-fp";
import { createSchemaFromType } from "@shared/util-schema";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
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

@AdditionalProperties(false)
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

const expectedSDL = `type User {
  id: ID
  name: String
  comments: [Comment]
  skills: [String]
  address: Address
}

type Comment {
  text: String
}

type Address {
  address: String
  city: City
}

type City {
  name: String
}
`;

describe("Given a JSON schema type", () => {
    const schema = extractRight(createSchemaFromType(userKey, User));

    describe("when converting it to a GraphQL schema", () => {
        const types = toGraphQLType(schema);

        it("then it is successfully converted", () => {
            const sdl = g.printSchema(new g.GraphQLSchema({ types: [types] }));
            expect(sdl).toEqual(expectedSDL);
        });
    });
});
