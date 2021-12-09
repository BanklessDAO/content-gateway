/* eslint-disable @typescript-eslint/ban-types */
import {
    ArrayRef,
    extractSchemaDescriptor,
    ObjectRef,
    Property,
    Required,
    Schema,
    Type,
} from ".";

@Type()
class Comment {
    @Property()
    text: string;
}

@Type()
class Address {
    @Property({
        required: Required.OPTIONAL,
    })
    text: string;
}

@Schema({
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
    @Property()
    name: string;
    @ObjectRef({
        type: Address,
    })
    address: Address;
    @ArrayRef({
        type: Comment,
    })
    comments: Comment[];
}

describe("test", () => {
    it("test", () => {
        console.log(JSON.stringify(extractSchemaDescriptor(User), null, 2));
    });
});
