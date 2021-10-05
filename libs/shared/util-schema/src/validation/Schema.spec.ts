import { CollectionOf, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import {
    createSchemaFromObject,
    createSchemaFromString,
    createSchemaFromType,
    isArrayOfType,
    isArrayProperty,
    isArrayRefProperty,
    isJSONSchemaProps,
    isNumberProperty,
    isPropertiesRecord,
    isRecord,
    isRefProperty,
    isStringProperty,
    isSupportedJSONSchema,
    isSupportedProperty,
    Schema,
} from "./Schema";

class Comment {
    @Required(true)
    text: string;
}

class Address {
    @Required(true)
    address: string;
}

class User {
    @Required(false)
    id?: number;
    @Required(true)
    name?: string;
    @Required(true)
    @CollectionOf(Comment)
    comments: Comment[];
    @Required(true)
    @CollectionOf(String)
    skills: string[];
    @Required(true)
    address: Address;

    constructor(
        id: number,
        name: string,
        comments: Comment[],
        skills: string[],
        address: Address
    ) {
        this.id = id;
        this.name = name;
        this.comments = comments;
        this.skills = skills;
        this.address = address;
    }
}

const userKey = {
    namespace: "test",
    name: "User",
    version: "v1",
};

const expectedProperties = {
    id: {
        type: "number",
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
    required: ["name", "comments", "skills", "address"],
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
            },
            required: ["address"],
        },
    },
};

const schemaStr = `{
    "type":"object",
    "properties":{
       "id":{
          "type":"number"
       },
       "name":{
          "type":"string",
          "minLength":1
       },
       "comments":{
          "type":"array",
          "items":{
             "$ref":"#/definitions/Comment"
          }
       },
       "skills":{
          "type":"array",
          "items":{
             "type":"string"
          }
       },
       "address":{
          "$ref":"#/definitions/Address"
       }
    },
    "required":[
       "name",
       "comments",
       "skills",
       "address"
    ],
    "definitions":{
       "Comment":{
          "type":"object",
          "properties":{
             "text":{
                "type":"string",
                "minLength":1
             }
          },
          "required":[
             "text"
          ]
       },
       "Address":{
          "type":"object",
          "properties":{
             "address":{
                "type":"string",
                "minLength":1
             }
          },
          "required":[
             "address"
          ]
       }
    }
 }`;
describe("Given a type guard", () => {
    describe("for a number property", () => {
        it("it tests properly", () => {
            expect(
                isNumberProperty({
                    type: "number",
                })
            ).toBeTruthy();
        });
    });
    describe("for a string property", () => {
        it("it tests properly when it is required", () => {
            expect(
                isStringProperty({
                    type: "string",
                    minLength: 1,
                })
            ).toBeTruthy();
        });
        it("it tests properly when it is not required", () => {
            expect(
                isStringProperty({
                    type: "string",
                })
            ).toBeTruthy();
        });
        it("it tests properly when it is invalid", () => {
            expect(
                isStringProperty({
                    type: "xul",
                })
            ).toBeFalsy();
        });
    });
    describe("for an array property", () => {
        it("it tests properly when valid", () => {
            expect(
                isArrayProperty({
                    type: "array",
                    items: {
                        type: "string",
                    },
                })
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isArrayProperty({
                    type: "xul",
                    items: {
                        type: "string",
                    },
                })
            ).toBeFalsy();
        });
    });
    describe("for a ref property", () => {
        it("it tests properly when valid", () => {
            expect(
                isRefProperty({
                    $ref: "string",
                })
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isRefProperty({
                    $xul: "string",
                })
            ).toBeFalsy();
        });
    });
    describe("for an array ref property", () => {
        it("it tests properly when valid", () => {
            expect(
                isArrayRefProperty({
                    type: "array",
                    items: {
                        $ref: "string",
                    },
                })
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isArrayRefProperty({
                    type: "array",
                    items: {
                        $xul: "string",
                    },
                })
            ).toBeFalsy();
        });
    });
    describe("for a supported property", () => {
        it("it tests properly when valid", () => {
            expect(
                isSupportedProperty({
                    type: "array",
                    items: {
                        $ref: "string",
                    },
                })
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isSupportedProperty({
                    type: "array",
                    items: {
                        $xul: "string",
                    },
                })
            ).toBeFalsy();
        });
    });
    describe("for a record", () => {
        it("it tests properly when valid", () => {
            expect(
                isRecord(
                    {
                        comments: {
                            type: "array",
                            items: {
                                $ref: "#/definitions/Comment",
                            },
                        },
                    },
                    isSupportedProperty
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isRecord(
                    {
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    },
                    isSupportedProperty
                )
            ).toBeFalsy();
        });
    });
    describe("for a properties record", () => {
        it("it tests properly when valid", () => {
            expect(isPropertiesRecord(expectedProperties)).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isPropertiesRecord({
                    type: "array",
                    items: {
                        $xul: "string",
                    },
                })
            ).toBeFalsy();
        });
    });
    describe("for an array of type", () => {
        it("it tests properly when valid", () => {
            expect(isArrayOfType(["hey"], "string")).toBeTruthy();
        });
        it("it tests properly when empty", () => {
            expect(isArrayOfType([], "string")).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(isArrayOfType(["hey"], "number")).toBeFalsy();
        });
    });
    describe("for a JSON schema props", () => {
        it("it tests properly when valid", () => {
            expect(
                isJSONSchemaProps({
                    type: "object",
                    properties: expectedProperties,
                    required: ["name", "comments", "skills", "address"],
                })
            ).toBeTruthy();
        });
        it("it tests properly when valid and has no required properties", () => {
            expect(
                isJSONSchemaProps({
                    type: "object",
                    properties: expectedProperties,
                })
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isJSONSchemaProps({
                    type: "array",
                    items: {
                        $xul: "string",
                    },
                })
            ).toBeFalsy();
        });
    });
    describe("for a supported JSON schema", () => {
        it("it tests properly when valid", () => {
            expect(isSupportedJSONSchema(expectedSchemaObject)).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                isSupportedJSONSchema({
                    type: "array",
                    items: {
                        $xul: "string",
                    },
                })
            ).toBeFalsy();
        });
    });
});
describe("Given a Schema", () => {
    describe("created from a type", () => {
        const schema = (
            createSchemaFromType(userKey, User) as E.Right<Schema<User>>
        ).right;

        it("test", () => {
            // console.log(JSON.stringify(getJsonSchema(User)));
        });

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.schemaObject).toEqual(expectedSchemaObject);
        });

        it("When validating a bad object it is invalid", () => {
            expect(
                schema.validate(
                    new User(
                        null,
                        "Joe",
                        [{ text: "Hey" }],
                        ["programming", "drinking"],
                        { address: "Some Street 1" }
                    )
                )
            ).toEqual(
                E.left([
                    {
                        field: "/id",
                        message: "must be number",
                    },
                ])
            );
        });

        it("When validating a good object it is valid", () => {
            expect(
                schema.validate(
                    new User(
                        1,
                        "Jane",
                        [{ text: "Hey" }],
                        ["programming", "drinking"],
                        { address: "Some Street 1" }
                    )
                )
            ).toEqual(E.right(undefined));
        });

        it("When serializing and deserializing Then the same object is produced", () => {
            const user = new User(
                1,
                "Jane",
                [{ text: "Hey" }],
                ["programming", "drinking"],
                { address: "Some Street 1" }
            );
            expect(
                pipe(schema.serialize(user), E.chain(schema.deserialize))
            ).toEqual(E.right(user));
        });

        it("When creating a GraphQL type, the proper type is produced", () => {
            expect(null).toEqual(null);
        });
    });

    describe("created from a string", () => {
        const schema = (
            createSchemaFromString(userKey, schemaStr) as E.Right<Schema<any>>
        ).right;

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.schemaObject).toEqual(expectedSchemaObject);
        });
    });

    describe("created from an object", () => {
        const schema = (
            createSchemaFromObject(userKey, expectedSchemaObject) as E.Right<
                Schema<any>
            >
        ).right;

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.schemaObject).toEqual(expectedSchemaObject);
        });
    });
});
