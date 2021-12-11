import { createGraphQLClient, GraphQLClient } from "@shared/util-data";
import { ScheduleMode } from "@shared/util-loaders";
import { Data, NonEmptyProperty } from "@shared/util-schema";
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
            where: { created_gt: $cursor }
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

const Token = t.strict({
    id: t.string,
    created: t.string,
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

const INFO = {
    namespace: "poap",
    name: "POAPToken",
    version: "V1",
};

@Data({
    info: INFO,
})
class POAPToken {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    ownerId: string;
    @NonEmptyProperty()
    eventId: string;
    @NonEmptyProperty()
    createdAt: number;
}

export class POAPTokenLoader extends GraphQLDataLoaderBase<Tokens, POAPToken> {
    public info = INFO;

    protected cursorMode = "cursor" as const;
    protected batchSize = BATCH_SIZE;
    protected type = POAPToken;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = QUERY;
    protected codec = Tokens;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(result: Tokens): Array<POAPToken> {
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
