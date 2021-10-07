import { CollectionOf, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import {
    createDefaultJSONSerializer,
    createSchemaFromObject,
    createSchemaFromString,
    createSchemaFromType,
    Schema,
} from ".";
import * as t from "./codecs";

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
    id?: string;
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

const schemaStr = `{
    "type":"object",
    "properties":{
       "id":{
          "type":"string",
          "minLength":1
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
       "id",
       "name",
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
             },
             "city":{
                "$ref":"#/definitions/City"
             }
          },
          "required":[
             "address",
             "city"
          ]
       },
       "City":{
          "type":"object",
          "properties":{
             "name":{
                "type":"string",
                "minLength":1
             }
          },
          "required":[
             "name"
          ]
       }
    }
}`;

const serializer = createDefaultJSONSerializer();

describe("Given a type guard", () => {
    describe("for a number property", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.numberPropertyCodec.decode({
                        type: "number",
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.numberPropertyCodec.decode({
                        type: "string",
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for a string property", () => {
        it("it tests properly when it is required", () => {
            expect(
                E.isRight(
                    t.stringPropertyCodec.decode({
                        type: "string",
                        minLength: 1,
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when it is not required", () => {
            expect(
                E.isRight(
                    t.stringPropertyCodec.decode({
                        type: "string",
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when it is invalid", () => {
            expect(
                E.isRight(
                    t.stringPropertyCodec.decode({
                        type: "xul",
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for an array property", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.arrayPropertyCodec.decode({
                        type: "array",
                        items: {
                            type: "string",
                        },
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.arrayPropertyCodec.decode({
                        type: "xul",
                        items: {
                            type: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for a ref property", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.refPropertyCodec.decode({
                        $ref: "string",
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.refPropertyCodec.decode({
                        $xul: "string",
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for an array ref property", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.arrayRefPropertyCodec.decode({
                        type: "array",
                        items: {
                            $ref: "string",
                        },
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.arrayPropertyCodec.decode({
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for a supported property", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.supportedPropertyCodec.decode({
                        type: "array",
                        items: {
                            $ref: "string",
                        },
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.supportedPropertyCodec.decode({
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for a properties record", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.supportedPropertyRecordCodec.decode(expectedProperties)
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.supportedPropertyRecordCodec.decode({
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for a JSON schema props", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.jsonSchemaTypeCodec.decode({
                        type: "object",
                        properties: expectedProperties,
                        required: ["name", "comments", "skills", "address"],
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when valid and has no required properties", () => {
            expect(
                E.isRight(
                    t.jsonSchemaTypeCodec.decode({
                        type: "object",
                        properties: expectedProperties,
                    })
                )
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.jsonSchemaTypeCodec.decode({
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
    });
    describe("for a supported JSON schema", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(t.jsonSchemaTypeCodec.decode(expectedSchemaObject))
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.jsonSchemaTypeCodec.decode({
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
    });
});
describe("Given a Schema", () => {
    describe("created from a type", () => {
        const schema = (
            createSchemaFromType(serializer)(userInfo, User) as E.Right<Schema>
        ).right;

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.schemaObject).toEqual(expectedSchemaObject);
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
            ).toEqual(E.right(undefined));
        });

        it("When serializing and deserializing Then the same object is produced", () => {
            const user = {
                id: "1",
                name: "Jane",
                comments: [{ text: "Hey" }],
                skills: ["programming", "drinking"],
                address: {
                    address: "Some Street 1",
                    city: { name: "London" },
                },
            };
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
            createSchemaFromString(serializer)(
                userInfo,
                schemaStr
            ) as E.Right<Schema>
        ).right;

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.schemaObject).toEqual(expectedSchemaObject);
        });
    });

    describe("created from an object", () => {
        const schema = (
            createSchemaFromObject(serializer)(
                userInfo,
                expectedSchemaObject
            ) as E.Right<Schema>
        ).right;

        it("When accessing its schema object then it should be correct", () => {
            expect(schema.schemaObject).toEqual(expectedSchemaObject);
        });
    });
});
