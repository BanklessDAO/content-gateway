import { createGraphQLClient, GraphQLClient } from "@banklessdao/util-data";
import { ScheduleMode } from "@shared/util-loaders";
import { Data, NonEmptyProperty } from "@banklessdao/util-schema";
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
            where: { timestamp_gte: $cursor }
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

const TransferCodec = t.strict({
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

const TransfersCodec = t.strict({
    transfers: t.array(TransferCodec),
});

type Transfers = t.TypeOf<typeof TransfersCodec>;

const INFO = {
    namespace: "poap",
    name: "Transfer",
    version: "V1",
};

@Data({
    info: INFO,
})
class Transfer {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    transaction: string;
    @NonEmptyProperty()
    createdAt: number;
    @NonEmptyProperty()
    tokenId: string;
    @NonEmptyProperty()
    fromId: string;
    @NonEmptyProperty()
    toId: string;
}

export class POAPTransferLoader extends GraphQLDataLoaderBase<
    Transfers,
    Transfer
> {
    public info = INFO;

    protected cursorMode = "cursor" as const;
    protected batchSize = BATCH_SIZE;
    protected type = Transfer;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = QUERY;
    protected codec = TransfersCodec;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(result: Transfers): Array<Transfer> {
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
