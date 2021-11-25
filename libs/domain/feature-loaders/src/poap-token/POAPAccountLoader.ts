import {
    createGraphQLClient,
    GraphQLClient,
    LoadContext
} from "@shared/util-loaders";
import { DocumentNode } from "graphql";
import * as t from "io-ts";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";
import { POAP_TOKEN_SUBGRAPH_ACCOUNTS } from "./queries";
import { POAPAccount, poapAccountInfo } from "./types";

const graphQLURL = "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai";

const Account = t.strict({
    id: t.string,
    tokensOwned: t.string,
});

const Accounts = t.strict({
    accounts: t.array(Account),
});

type Accounts = t.TypeOf<typeof Accounts>;

export class POAPAccountLoader extends GraphQLDataLoaderBase<
    Accounts,
    POAPAccount
> {
    public info = poapAccountInfo;

    protected cursorMode = "skip" as const;
    protected batchSize = BATCH_SIZE;
    protected type = POAPAccount;
    protected cadenceConfig = {
        fullBatch: { minutes: 1 },
        partialBatch: { minutes: 5 },
    };

    protected graphQLQuery: DocumentNode = POAP_TOKEN_SUBGRAPH_ACCOUNTS;
    protected codec = Accounts;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapGraphQLResult(result: Accounts): Array<POAPAccount> {
        return result.accounts.map((account) => ({
            id: account.id,
            tokensOwned: parseInt(account.tokensOwned),
        }));
    }

    protected getNextCursor(
        result: Array<POAPAccount>,
        { cursor }: LoadContext
    ) {
        return (parseInt(cursor ?? "0") + result.length).toString();
    }
}

export const createPOAPAccountLoader: () => POAPAccountLoader = () =>
    new POAPAccountLoader(createGraphQLClient(graphQLURL));
