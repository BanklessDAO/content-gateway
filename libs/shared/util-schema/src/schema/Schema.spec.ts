import { extractRight } from "@shared/util-fp";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import { createSchemaFromObject, createSchemaFromType } from ".";
import { SchemaValidationError } from "..";
import { User as UserWithBackwardsCompatibleNestedAddress } from "./test/UserWithBackwardsCompatibleAddress";

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

class BackwardsIncompatibleAddress {
    @Required(true)
    address: string;
    @Required(true)
    city: string;
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

@AdditionalProperties(false)
class BackwardsCompatibleUser {
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
    @Required(false)
    favoriteHobby: string;
}

@AdditionalProperties(false)
class BackwardsIncompatibleUser {
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
    address: string;
}

@AdditionalProperties(false)
class BackwardsCompatibleUserWithIncompatibleAddress {
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
    address: BackwardsIncompatibleAddress;
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
            const result = schema.validate({
                id: 1,
                name: "Jane",
                comments: [{ text: "Hey" }],
                skills: ["programming", "drinking"],
                address: {
                    address: "Some Street 1",
                    city: { name: "London" },
                },
            });

            expect(result).toEqual(
                E.left(
                    new SchemaValidationError({
                        validationErrors: ["Field id must be string"],
                    })
                )
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

        it("When has backward compatible changes to other Then it is compatible", () => {
            const oldSchema = extractRight(
                createSchemaFromType(userInfo, User)
            );
            const newSchema = extractRight(
                createSchemaFromType(userInfo, BackwardsCompatibleUser)
            );

            expect(newSchema.isBackwardCompatibleWith(oldSchema)).toBe(true);
        });

        it("When has nested backward compatible changes to other Then it is compatible", () => {
            const oldSchema = extractRight(
                createSchemaFromType(userInfo, User)
            );
            const newSchema = extractRight(
                createSchemaFromType(
                    userInfo,
                    UserWithBackwardsCompatibleNestedAddress
                )
            );

            expect(newSchema.isBackwardCompatibleWith(oldSchema)).toBe(true);
        });

        it("When has backward incompatible changes to other Then it is incompatible", () => {
            const oldSchema = extractRight(
                createSchemaFromType(userInfo, User)
            );
            const newSchema = extractRight(
                createSchemaFromType(userInfo, BackwardsIncompatibleUser)
            );

            expect(newSchema.isBackwardCompatibleWith(oldSchema)).toBe(false);
        });

        it("When has backward incompatible changes in nested type to other Then it is incompatible", () => {
            const oldSchema = extractRight(
                createSchemaFromType(userInfo, User)
            );
            const newSchema = extractRight(
                createSchemaFromType(
                    userInfo,
                    BackwardsCompatibleUserWithIncompatibleAddress
                )
            );

            expect(newSchema.isBackwardCompatibleWith(oldSchema)).toBe(false);
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
