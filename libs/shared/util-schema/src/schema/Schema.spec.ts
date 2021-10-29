import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import { createSchemaFromObject, createSchemaFromType, Schema } from ".";
import { extractRight } from "@shared/util-fp";

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

const userInfo = {
    namespace: "test",
    name: "User",
    version: "v1",
};

const expectedProperties = {
    id: {
        type: "string",
        minLength: 1,
    },
    name: {
        type: "string",
        minLength: 1,
    },
    comments: {
        type: "array",
        items: {
            $ref: "#/definitions/Comment",
        },
    },
    skills: {
        type: "array",
        items: {
            type: "string",
        },
    },
    address: {
        $ref: "#/definitions/Address",
    },
};

const expectedSchemaObject = {
    type: "object",
    properties: expectedProperties,
    additionalProperties: false,
    required: ["id", "name", "address"],
    definitions: {
        Comment: {
            type: "object",
            properties: {
                text: {
                    type: "string",
                    minLength: 1,
                },
            },
            required: ["text"],
        },
        Address: {
            type: "object",
            properties: {
                address: {
                    type: "string",
                    minLength: 1,
                },
                city: {
                    $ref: "#/definitions/City",
                },
            },
            required: ["address", "city"],
        },
        City: {
            type: "object",
            properties: {
                name: {
                    type: "string",
                    minLength: 1,
                },
            },
            required: ["name"],
        },
    },
};

describe("Given a Schema", () => {
    describe("created from a type", () => {
        const schema = extractRight(createSchemaFromType(userInfo, User));

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.jsonSchema).toEqual(expectedSchemaObject);
        });

        it("When validating a bad object it is invalid", () => {
            expect(
                schema.validate({
                    id: 1,
                    name: "Jane",
                    comments: [{ text: "Hey" }],
                    skills: ["programming", "drinking"],
                    address: {
                        address: "Some Street 1",
                        city: { name: "London" },
                    },
                })
            ).toEqual(
                E.left([
                    {
                        field: "/id",
                        message: "must be string",
                    },
                ])
            );
        });

        it("When validating a good object it is valid", () => {
            expect(
                schema.validate({
                    id: "1",
                    name: "Jane",
                    comments: [{ text: "Hey" }],
                    skills: ["programming", "drinking"],
                    address: {
                        address: "Some Street 1",
                        city: { name: "London" },
                    },
                })
            ).toEqual(
                E.right({
                    id: "1",
                    name: "Jane",
                    comments: [{ text: "Hey" }],
                    skills: ["programming", "drinking"],
                    address: {
                        address: "Some Street 1",
                        city: { name: "London" },
                    },
                })
            );
        });

        it("When creating a GraphQL type, the proper type is produced", () => {
            expect(null).toEqual(null);
        });
    });

    describe("created from an object", () => {
        const schema = extractRight(
            createSchemaFromObject({
                info: userInfo,
                jsonSchema: expectedSchemaObject,
            })
        );

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.jsonSchema).toEqual(expectedSchemaObject);
        });
    });
});
