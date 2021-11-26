import { createGraphQLClient, GraphQLClient } from "@shared/util-loaders";
import { AdditionalProperties, Required } from "@tsed/schema";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const URL = "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai";

const QUERY: DocumentNode = gql`
    query poapTransfers($limit: Int, $cursor: String) {
        transfers(
            first: $limit
            orderBy: timestamp
            where: { timestamp_gt: $cursor }
        ) {
            id
            transaction
            timestamp
            token {
                id
            }
            from {
                id
            }
            to {
                id
            }
        }
    }
`;

const Transfer = t.strict({
    id: withMessage(t.string, () => "id must be a string"),
    transaction: withMessage(t.string, () => "transaction must be a string"),
    timestamp: withMessage(t.string, () => "timestamp must be a string"),
    token: withMessage(
        t.strict({
            id: t.string,
        }),
        () => "token is missing"
    ),
    from: withMessage(
        t.strict({
            id: t.string,
        }),
        () => "from is missing"
    ),
    to: withMessage(
        t.strict({
            id: t.string,
        }),
        () => "to is missing"
    ),
});

const Transfers = t.strict({
    transfers: t.array(Transfer),
});

type Transfers = t.TypeOf<typeof Transfers>;

const INFO = {
    namespace: "poap",
    name: "POAPTransfer",
    version: "V1",
};

@AdditionalProperties(false)
class POAPTransfer {
    @Required(true)
    id: string;
    @Required(true)
    transaction: string;
    @Required(true)
    createdAt: number;
    @Required(true)
    tokenId: string;
    @Required(true)
    fromId: string;
    @Required(true)
    toId: string;
}

export class POAPTransferLoader extends GraphQLDataLoaderBase<
    Transfers,
    POAPTransfer
> {
    public info = INFO;

    protected cursorMode = "cursor" as const;
    protected batchSize = BATCH_SIZE;
    protected type = POAPTransfer;
    protected cadenceConfig = {
        fullBatch: { seconds: 5 },
        partialBatch: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = QUERY;
    protected codec = Transfers;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(result: Transfers): Array<POAPTransfer> {
        return result.transfers.map((transfer) => ({
            id: transfer.id,
            transaction: transfer.transaction,
            createdAt: parseInt(transfer.timestamp),
            tokenId: transfer.token.id,
            fromId: transfer.from.id,
            toId: transfer.to.id,
        }));
    }

    protected extractCursor(transfers: Transfers) {
        return `${
            transfers.transfers[transfers.transfers.length - 1].timestamp
        }`;
    }
}

export const createPOAPTransferLoader: () => POAPTransferLoader = () =>
    new POAPTransferLoader(createGraphQLClient(URL));
