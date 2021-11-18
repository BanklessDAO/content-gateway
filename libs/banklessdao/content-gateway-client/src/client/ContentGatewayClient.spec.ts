import { createLogger } from "@shared/util-fp";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import { createClient } from "./";
import { ContentGatewayClient } from "./ContentGatewayClient";
import {
    createOutboundAdapterStub,
    OutboundDataAdapterStub,
} from "./OutboundDataAdapter";

class Comment {
    @Required(true)
    text: string;
}

@AdditionalProperties(false)
class Post {
    @Required(true)
    id: string;
    @Required(true)
    content: string;
    @Required(true)
    @CollectionOf(Comment)
    comments: Comment[];
}

@AdditionalProperties(false)
class InvalidPost {
    @Required(true)
    id: string;
    @Required(true)
    content: string;
    @Required(true)
    // 👇 missing annotation
    comments: Comment[];
}

const info = {
    namespace: "test",
    name: "Post",
    version: "V1",
};

const validPost: Post = {
    id: "1",
    content: "Hello World",
    comments: [{ text: "Hello" }, { text: "World" }],
};

const invalidPostWithExtraData = {
    id: "1",
    content: "Hello World",
    comments: [{ text: "Hello" }, { text: "World" }],
    sneakyAttack: "I am a sneaky attack",
};

const invalidPostWithMissingData = {
    id: "1",
    comments: [{ text: "Hello" }, { text: "World" }],
};

describe("Given a gateway client", () => {
    const logger = createLogger("ContentGatewayClient.spec");
    let adapterStub: OutboundDataAdapterStub;
    let client: ContentGatewayClient;

    beforeEach(() => {
        adapterStub = createOutboundAdapterStub();
        client = createClient({ adapter: adapterStub });
    });

    it("When registering a valid schema Then it should register properly", async () => {
        const result = await client.register(info, Post)();

        const expected = {
            info: { namespace: "test", name: "Post", version: "V1" },
            jsonSchema: {
                type: "object",
                properties: {
                    id: { type: "string", minLength: 1 },
                    content: { type: "string", minLength: 1 },
                    comments: {
                        type: "array",
                        items: { $ref: "#/definitions/Comment" },
                    },
                },
                additionalProperties: false,
                required: ["id", "content", "comments"],
                definitions: {
                    Comment: {
                        type: "object",
                        properties: { text: { type: "string", minLength: 1 } },
                        required: ["text"],
                    },
                },
            },
        };

        expect(result).toEqual(E.right(undefined));
        expect(adapterStub.schemas[0]).toEqual(expected);
    });

    it("When registering an invalid schema Then it returns an error", async () => {
        const result = await client.register(info, InvalidPost)();
        expect(E.isLeft(result)).toBeTruthy();
    });

    it("When sending a valid payload Then it is sent properly", async () => {
        await client.register(info, Post)();
        const result = await client.save({
            info: info,
            data: validPost,
            cursor: "0",
        })();

        expect(result).toEqual(E.right(undefined));
        expect(adapterStub.payloads).toEqual([
            {
                info: { namespace: "test", name: "Post", version: "V1" },
                cursor: "0",
                data: {
                    id: "1",
                    content: "Hello World",
                    comments: [{ text: "Hello" }, { text: "World" }],
                },
            },
        ]);
    });

    it("When sending an unregistered payload Then an error is returned", async () => {
        const result = await client.save({
            info: info,
            data: validPost,
            cursor: "0",
        })();

        expect(result).toEqual(
            E.left(new Error("The given type test.Post.V1 is not registered"))
        );
    });

    it("When sending a payload with missing data Then an error is returned", async () => {
        await client.register(info, Post)();
        const result = await client.save({
            info: info,
            data: invalidPostWithMissingData,
            cursor: "0",
        })();

        expect(result).toEqual(
            E.left(new Error("field  must have required property 'content'"))
        );
    });

    // TODO: add it to the docs that they should use @AdditionalProperties(false)
    it("When sending a payload with extra data Then an error is returned", async () => {
        await client.register(info, Post)();
        const result = await client.save({
            info: info,
            data: invalidPostWithExtraData,
            cursor: "0",
        })();

        expect(result).toEqual(
            E.left(new Error("field  must NOT have additional properties"))
        );
    });
});
