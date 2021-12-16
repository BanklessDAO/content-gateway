/* eslint-disable @typescript-eslint/ban-types */
import * as E from "fp-ts/Either";
import {
    ArrayRef,
    Data,
    extractSchemaDescriptor,
    Nested,
    ObjectRef,
    Property,
    Required
} from ".";

@Nested()
class Comment {
    @Property({
        required: Required.REQUIRED,
    })
    text: string;
}

@Nested()
class Address {
    @Property({
        required: Required.OPTIONAL,
    })
    text: string;
}

@Data({
    info: {
        namespace: "test",
        name: "User",
        version: "V1",
    },
})
class User {
    @Property({
        required: Required.OPTIONAL,
    })
    id: string;
    @Property({
        required: Required.REQUIRED,
    })
    name: string;

    @ObjectRef({
        type: Address,
        required: Required.REQUIRED,
    })
    address: Address;

    @ArrayRef({
        type: Comment,
        required: Required.REQUIRED,
    })
    comments: Comment[];
}

const expectedJSON = {
    properties: {
        id: {
            name: "id",
            type: {
                _tag: "string",
            },
            required: "OPTIONAL",
        },
        name: {
            name: "name",
            type: {
                _tag: "string",
            },
            required: "REQUIRED",
        },
        address: {
            name: "address",
            type: {
                _tag: "object-ref",
                descriptor: {
                    name: "Address",
                    properties: {
                        text: {
                            name: "text",
                            type: {
                                _tag: "string",
                            },
                            required: "OPTIONAL",
                        },
                    },
                },
            },
            required: "REQUIRED",
        },
        comments: {
            name: "comments",
            type: {
                _tag: "array-ref",
                descriptor: {
                    name: "Comment",
                    properties: {
                        text: {
                            name: "text",
                            type: {
                                _tag: "string",
                            },
                            required: "REQUIRED",
                        },
                    },
                },
            },
            required: "REQUIRED",
        },
    },
    info: {
        namespace: "test",
        name: "User",
        version: "V1",
    },
};

describe("Given a decorated class hierarchy", () => {
    it("When creating a schema descriptor from them Then it works", () => {
        expect(extractSchemaDescriptor(User)).toEqual(E.right(expectedJSON));
    });
});
