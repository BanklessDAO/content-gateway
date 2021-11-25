import { createGraphQLClient, GraphQLClient } from "@shared/util-loaders";
import { DocumentNode } from "graphql";
import * as t from "io-ts";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";
import { POAP_TOKEN_SUBGRAPH_TOKENS } from "./queries";
import { POAPToken, poapTokenInfo } from "./types";

const graphQLURL = "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai";

const Token = t.strict({
    id: t.string,
    created: t.string,
    transferCount: t.string,
    owner: t.strict({
        id: t.string,
    }),
    event: t.strict({
        id: t.string,
    }),
});

const Tokens = t.strict({
    tokens: t.array(Token),
});

type Tokens = t.TypeOf<typeof Tokens>;

export class PoapTokenLoader extends GraphQLDataLoaderBase<Tokens, POAPToken> {
    public info = poapTokenInfo;

    protected cursorMode = "cursor" as const;
    protected batchSize = BATCH_SIZE;
    protected type = POAPToken;
    protected cadenceConfig = {
        fullBatch: { minutes: 1 },
        partialBatch: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = POAP_TOKEN_SUBGRAPH_TOKENS;
    protected codec = Tokens;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapGraphQLResult(result: Tokens): Array<POAPToken> {
        return result.tokens.map((token) => ({
            id: token.id,
            transferCount: parseInt(token.transferCount),
            mintedAt: parseInt(token.created),
            ownerId: token.owner.id,
            eventId: token.event.id,
        }));
    }

    protected getNextCursor(result: Array<POAPToken>) {
        return result.length > 0
            ? result[result.length - 1].mintedAt.toString()
            : "0";
    }
}

export const createPOAPTokenLoader: () => PoapTokenLoader = () =>
    new PoapTokenLoader(createGraphQLClient(graphQLURL));
