import { extractRight } from "@banklessdao/util-misc";
import {
  createSchemaFromClass,
  Data,
  NonEmptyProperty,
  RequiredArrayRef,
  RequiredObjectRef,
  RequiredStringArrayOf
} from "@banklessdao/util-schema";
import * as g from "graphql";
import { toGraphQLType } from "./converters";

const info = {
    namespace: "test",
    name: "User",
    version: "V1",
};

class Comment {
    @NonEmptyProperty()
    text: string;
}

class City {
    @NonEmptyProperty()
    name: string;
}

class Address {
    @NonEmptyProperty()
    address: string;
    @RequiredObjectRef(City)
    city: City;
}

@Data({
    info,
})
class User {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name?: string;
    @RequiredArrayRef(Comment)
    comments: Comment[];
    @RequiredStringArrayOf()
    skills: string[];
    @RequiredObjectRef(Address)
    address: Address;
}

const expectedSDL = `type TestUserV1 {
  id: String
  name: String
  comments: [TestCommentV1]
  skills: [String]
  address: TestAddressV1
}

type TestCommentV1 {
  id: ID!
  text: String
}

type TestAddressV1 {
  id: ID!
  address: String
  city: TestCityV1
}

type TestCityV1 {
  id: ID!
  name: String
}
`;

describe("Given a JSON schema type", () => {
    const schema = extractRight(createSchemaFromClass(User));

    describe("when converting it to a GraphQL schema", () => {
        const types = toGraphQLType(schema);

        it("then it is successfully converted", () => {
            const sdl = g.printSchema(new g.GraphQLSchema({ types: [types] }));
            expect(sdl).toEqual(expectedSDL);
        });
    });
});
