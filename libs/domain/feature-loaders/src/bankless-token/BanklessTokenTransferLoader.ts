import { createGraphQLClient, GraphQLClient } from "@banklessdao/util-data";
import { notEmpty } from "@banklessdao/util-misc";
import { DEFAULT_CURSOR, ScheduleMode } from "@shared/util-loaders";
import { Data, NonEmptyProperty, OptionalProperty } from "@banklessdao/util-schema";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const URL = "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph";

const QUERY: DocumentNode = gql`
    query banklessTokenTransactions($limit: Int, $cursor: String) {
        erc20Transfers(
            first: $limit
            orderBy: timestamp
            where: { timestamp_gte: $cursor }
        ) {
            id
            transaction {
                id
            }
            timestamp
            from {
                id
            }
            to {
                id
            }
            value
        }
    }
`;

const INFO = {
    namespace: "bankless-token",
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
    transactionId: string;
    @NonEmptyProperty()
    value: string;
    @NonEmptyProperty()
    createdAt: number;

    @OptionalProperty()
    fromId?: string;
    @OptionalProperty()
    toId?: string;
}

const EntityWithIdCodec = t.strict({
    id: t.string,
});

const BANKTransferCodec = t.intersection([
    t.strict({
        id: withMessage(t.string, () => "id is required"),
        transaction: withMessage(
            EntityWithIdCodec,
            () => "transaction is required"
        ),
        timestamp: withMessage(t.string, () => "timestamp is required"),
        value: withMessage(t.string, () => "value is required"),
    }),
    t.partial({
        from: t.union([EntityWithIdCodec, t.null]),
        to: t.union([EntityWithIdCodec, t.null]),
    }),
]);

const BANKTransfersCodec = t.strict({
    erc20Transfers: t.array(BANKTransferCodec),
});

type BANKTransfers = t.TypeOf<typeof BANKTransfersCodec>;

export class BANKTransferLoader extends GraphQLDataLoaderBase<
    BANKTransfers,
    Transfer
> {
    public info = INFO;
    protected batchSize = BATCH_SIZE;
    protected type = Transfer;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = QUERY;
    protected codec = BANKTransfersCodec;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(transfers: BANKTransfers): Array<Transfer> {
        return transfers.erc20Transfers
            .map((transfer) => {
                return {
                    id: transfer.id,
                    createdAt: parseInt(transfer.timestamp),
                    value: transfer.value,
                    transactionId: transfer.transaction.id,
                    fromId: transfer.from ? transfer.from.id : undefined,
                    toId: transfer.to ? transfer.to.id : undefined,
                };
            })
            .filter(notEmpty);
    }

    protected extractCursor(transfers: BANKTransfers) {
        const obj = transfers.erc20Transfers;
        if (obj.length === 0) {
            return DEFAULT_CURSOR;
        }
        return `${obj[obj.length - 1].timestamp}`;
    }
}

export const createBANKTransferLoader: () => BANKTransferLoader = () =>
    new BANKTransferLoader(createGraphQLClient(URL));
