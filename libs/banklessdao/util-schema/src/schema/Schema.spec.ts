import { extractRight } from "@banklessdao/util-misc";
import * as E from "fp-ts/Either";
import {
    createSchemaFromClass,
    createSchemaFromObject,
    Data,
    Nested,
    NonEmptyProperty,
    OptionalArrayRef,
    OptionalObjectRef,
    OptionalProperty,
    OptionalStringArrayOf,
    RequiredObjectRef,
    SchemaValidationError,
} from "..";
import { User as UserWithBackwardsCompatibleNestedAddress } from "./test/UserWithBackwardsCompatibleAddress";

const userInfo = {
    namespace: "test",
    name: "User",
    version: "v1",
};

@Nested()
class Comment {
    @NonEmptyProperty()
    text: string;
}

@Nested()
class City {
    @NonEmptyProperty()
    name: string;
}

@Nested()
class Address {
    @NonEmptyProperty()
    address: string;

    @RequiredObjectRef(City)
    city: City;
}

@Data({
    info: userInfo,
})
class User {
    @NonEmptyProperty()
    id: string;

    @NonEmptyProperty()
    name: string;

    @OptionalArrayRef(Comment)
    comments: Comment[];

    @OptionalStringArrayOf()
    skills: string[];

    @RequiredObjectRef(Address)
    address: Address;
}

class BackwardsIncompatibleAddress {
    @NonEmptyProperty()
    address: string;
    @NonEmptyProperty()
    city: string;
}

@Data({
    info: userInfo,
})
class BackwardsCompatibleUser {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name: string;
    @OptionalArrayRef(Comment)
    comments: Comment[];
    @OptionalStringArrayOf()
    skills: string[];
    @RequiredObjectRef(Address)
    address: Address;
    @OptionalProperty()
    favoriteHobby: string;
}

@Data({
    info: userInfo,
})
class BackwardsIncompatibleUser {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name?: string;
    @OptionalObjectRef(Comment)
    comments: Comment[];
    @OptionalStringArrayOf()
    skills: string[];
    @NonEmptyProperty()
    address: string;
}

@Data({
    info: userInfo,
})
class BackwardsCompatibleUserWithIncompatibleAddress {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    name: string;
    @OptionalArrayRef(Comment)
    comments: Comment[];
    @OptionalStringArrayOf()
    skills: string[];
    @RequiredObjectRef(BackwardsIncompatibleAddress)
    address: BackwardsIncompatibleAddress;
}

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
    describe("created from a class", () => {
        const schema = extractRight(createSchemaFromClass(User));

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

        it("When has backward compatible changes to other Then it is compatible", () => {
            const oldSchema = extractRight(createSchemaFromClass(User));
            const newSchema = extractRight(
                createSchemaFromClass(BackwardsCompatibleUser)
            );

            expect(newSchema.isBackwardCompatibleWith(oldSchema)).toBe(true);
        });

        it("When has nested backward compatible changes to other Then it is compatible", () => {
            const oldSchema = extractRight(createSchemaFromClass(User));
            const newSchema = extractRight(
                createSchemaFromClass(UserWithBackwardsCompatibleNestedAddress)
            );

            expect(newSchema.isBackwardCompatibleWith(oldSchema)).toBe(true);
        });

        it("When has backward incompatible changes to other Then it is incompatible", () => {
            const oldSchema = extractRight(createSchemaFromClass(User));
            const newSchema = extractRight(
                createSchemaFromClass(BackwardsIncompatibleUser)
            );

            expect(newSchema.isBackwardCompatibleWith(oldSchema)).toBe(false);
        });

        it("When has backward incompatible changes in nested type to other Then it is incompatible", () => {
            const oldSchema = extractRight(createSchemaFromClass(User));
            const newSchema = extractRight(
                createSchemaFromClass(
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

    describe("created from a class", () => {
        const schema = extractRight(createSchemaFromClass(User));

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.jsonSchema).toEqual(expectedSchemaObject);
        });
    });
});
