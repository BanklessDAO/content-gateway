import { notEmpty } from "@shared/util-fp";
import {
    createGraphQLClient,
    DEFAULT_CURSOR,
    GraphQLClient,
} from "@shared/util-loaders";
import { AdditionalProperties, Required } from "@tsed/schema";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";
import * as t from "io-ts";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const URL = "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph";

const QUERY: DocumentNode = gql`
    query banklessTokenTransactions($limit: Int, $cursor: String) {
        transactions(
            first: $limit
            orderBy: timestamp
            where: { timestamp_gt: $cursor }
        ) {
            id
            timestamp
            blockNumber
        }
    }
`;

const INFO = {
    namespace: "bankless-token",
    name: "BANKTransaction",
    version: "V1",
};

@AdditionalProperties(false)
class BANKTransaction {
    @Required(true)
    id: string;
    @Required(true)
    createdAt: number;
    @Required(true)
    blockNumber: number;
}

const BANKTransactionCodec = t.strict({
    id: t.string,
    timestamp: t.string,
    blockNumber: t.string,
});

const BANKTransactionsCodec = t.strict({
    transactions: t.array(BANKTransactionCodec),
});

type BANKTransactions = t.TypeOf<typeof BANKTransactionsCodec>;

export class BANKTransactionLoader extends GraphQLDataLoaderBase<
    BANKTransactions,
    BANKTransaction
> {
    public info = INFO;
    protected batchSize = BATCH_SIZE;
    protected type = BANKTransaction;
    protected cadenceConfig = {
        fullBatch: { seconds: 5 },
        partialBatch: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = QUERY;
    protected codec = BANKTransactionsCodec;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(
        transactions: BANKTransactions
    ): Array<BANKTransaction> {
        return transactions.transactions
            .map((transaction) => {
                return {
                    id: transaction.id,
                    createdAt: parseInt(transaction.timestamp),
                    blockNumber: parseInt(transaction.blockNumber),
                };
            })
            .filter(notEmpty);
    }

    protected extractCursor(transactions: BANKTransactions) {
        const obj = transactions.transactions;
        if (obj.length === 0) {
            return DEFAULT_CURSOR;
        }
        return `${obj[obj.length - 1].timestamp}`;
    }
}

export const createBANKTransactionLoader: () => BANKTransactionLoader = () =>
    new BANKTransactionLoader(createGraphQLClient(URL));