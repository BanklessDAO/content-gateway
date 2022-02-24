import { createGraphQLClient, GraphQLClient } from "@banklessdao/util-data";
import { ScheduleMode } from "@shared/util-loaders";
import { Data, NonEmptyProperty } from "@banklessdao/util-schema";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";
import * as t from "io-ts";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const URL = "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai";

const QUERY: DocumentNode = gql`
    query poapTokens($limit: Int, $cursor: String) {
        tokens(
            first: $limit
            orderBy: created
            where: { created_gte: $cursor }
        ) {
            id
            created
            owner {
                id
            }
            event {
                id
            }
        }
    }
`;

const TokenCodec = t.strict({
    id: t.string,
    created: t.string,
    owner: t.strict({
        id: t.string,
    }),
    event: t.strict({
        id: t.string,
    }),
});

const TokensCodec = t.strict({
    tokens: t.array(TokenCodec),
});

type Tokens = t.TypeOf<typeof TokensCodec>;

const INFO = {
    namespace: "poap",
    name: "Token",
    version: "V1",
};

@Data({
    info: INFO,
})
class Token {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    ownerId: string;
    @NonEmptyProperty()
    eventId: string;
    @NonEmptyProperty()
    createdAt: number;
}

export class POAPTokenLoader extends GraphQLDataLoaderBase<Tokens, Token> {
    public info = INFO;

    protected cursorMode = "cursor" as const;
    protected batchSize = BATCH_SIZE;
    protected type = Token;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = QUERY;
    protected codec = TokensCodec;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(result: Tokens): Array<Token> {
        return result.tokens.map((token) => ({
            id: token.id,
            createdAt: parseInt(token.created),
            ownerId: token.owner.id,
            eventId: token.event.id,
        }));
    }

    protected extractCursor(tokens: Tokens) {
        return `${tokens.tokens[tokens.tokens.length - 1].created}`;
    }
}

export const createPOAPTokenLoader: () => POAPTokenLoader = () =>
    new POAPTokenLoader(createGraphQLClient(URL));
