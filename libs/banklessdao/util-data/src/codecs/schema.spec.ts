import { extractLeft } from "@banklessdao/util-misc";
import * as E from "fp-ts/Either";
import {
    SupportedJSONSchema,
    supportedJSONSchemaCodec,
    SupportedPropertyRecord,
} from "..";
import * as t from "./schema";

const validSupportedSchemaProperties: SupportedPropertyRecord = {
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

const invalidSchemaWithIdObject = {
    type: "object",
    properties: {
        name: {
            type: "string",
            minLength: 1,
        },
    },
    required: ["id"],
};

const validSchemaObject: SupportedJSONSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
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
    },
    required: ["id", "name", "comments", "skills", "address"],
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

const invalidSchemaObjectWithoutAdditionalProperties = {
    info: {
        namespace: "test",
        name: "User",
        version: "V1",
    },
    schema: {
        ...validSchemaObject,
        additionalProperties: undefined,
    },
};

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
        it("it tests properly when has bad type", () => {
            expect(
                E.isRight(
                    t.numberPropertyCodec.decode({
                        type: "string",
                    })
                )
            ).toBeFalsy();
        });
        it("it tests properly when has extra fields", () => {
            expect(
                t.numberPropertyCodec.decode({
                    type: "number",
                    foo: "bar",
                })
            ).toEqual(E.right({ type: "number" }));
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
        it("it tests properly when type is invalid", () => {
            expect(
                E.isRight(
                    t.stringPropertyCodec.decode({
                        type: "xul",
                    })
                )
            ).toBeFalsy();
        });
        it("it tests properly when has extra fields", () => {
            expect(
                t.stringPropertyCodec.decode({
                    type: "string",
                    foo: "bar",
                })
            ).toEqual(E.right({ type: "string" }));
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
        it("it tests properly when type is wrong", () => {
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
        it("it tests properly when has extra fields", () => {
            expect(
                t.arrayPropertyCodec.decode({
                    type: "array",
                    foo: "bar",
                    items: {
                        xul: "wom",
                        type: "string",
                    },
                })
            ).toEqual(
                E.right({
                    type: "array",
                    items: {
                        type: "string",
                    },
                })
            );
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
        it("it tests properly when ref is wrong", () => {
            expect(
                E.isRight(
                    t.refPropertyCodec.decode({
                        $xul: "string",
                    })
                )
            ).toBeFalsy();
        });
        it("it tests properly when has extra fields", () => {
            expect(
                t.refPropertyCodec.decode({
                    $ref: "string",
                    foo: "bar",
                })
            ).toEqual(E.right({ $ref: "string" }));
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
        it("it tests properly when ref is wrong", () => {
            expect(
                E.isRight(
                    t.arrayRefPropertyCodec.decode({
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
        it("it tests properly when has extra fields", () => {
            expect(
                t.arrayRefPropertyCodec.decode({
                    type: "array",
                    xul: "wom",
                    items: {
                        $ref: "string",
                        foo: "bar",
                    },
                })
            ).toEqual(E.right({ type: "array", items: { $ref: "string" } }));
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
        it("it tests properly when structure is not valid", () => {
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
        it("it tests properly when has extra fields", () => {
            expect(
                t.supportedPropertyCodec.decode({
                    type: "number",
                    foo: "bar",
                })
            ).toEqual(E.right({ type: "number" }));
        });
    });
    describe("for a properties record", () => {
        it("it tests properly when valid", () => {
            expect(
                E.isRight(
                    t.supportedPropertyRecordCodec.decode(
                        validSupportedSchemaProperties
                    )
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
                        properties: validSupportedSchemaProperties,
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
                        properties: validSupportedSchemaProperties,
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
                E.isRight(t.supportedJSONSchemaCodec.decode(validSchemaObject))
            ).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            expect(
                E.isRight(
                    t.supportedJSONSchemaCodec.decode({
                        type: "array",
                        items: {
                            $xul: "string",
                        },
                    })
                )
            ).toBeFalsy();
        });
    });

    /**
     * This object used to return an error about a missing id
     * while the comments specification was wrong instead.
     */
    const jsonSchemaWithIdRegression = {
        type: "object",
        additionalProperties: false,
        properties: {
            id: { type: "string", minLength: 1 },
            content: { type: "string", minLength: 1 },
            comments: { type: "array" },
        },
        required: ["id", "content", "comments"],
    };

    describe("for an object that should have id", () => {
        it("it tests properly when valid", () => {
            const result = t.hasIdCodec.decode(validSchemaObject);
            expect(E.isRight(result)).toBeTruthy();
        });
        it("it tests properly when invalid", () => {
            const result = t.hasIdCodec.decode(invalidSchemaWithIdObject);
            expect(E.isLeft(result)).toBeTruthy();
        });
    });

    describe("for a schema that should have additional properties", () => {
        it("it tests properly when invalid", () => {
            const result = extractLeft(
                t.schemaCodec.decode(
                    invalidSchemaObjectWithoutAdditionalProperties
                )
            );
            const firstError = result[0];
            expect(firstError.message).toEqual(
                `A schema must have additional properties disabled. Did you add @AdditionalProperties(false)?`
            );
        });
    });

    describe("the regression for a schema that should contain an embed error", () => {
        it("to contain an error about the missing embed annotation", () => {
            const result = extractLeft(
                supportedJSONSchemaCodec.decode(jsonSchemaWithIdRegression)
            );
            const firstError = result[0];
            expect(firstError.message).toEqual(
                `Schema type is missing`
            );
        });
    });
});
