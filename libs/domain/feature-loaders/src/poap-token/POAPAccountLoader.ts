import { createGraphQLClient, GraphQLClient } from "@shared/util-data";
import { ScheduleMode } from "@shared/util-loaders";
import {
    Data,
    NonEmptyProperty
} from "@shared/util-schema";
import gql from "graphql-tag";
import * as t from "io-ts";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const URL = "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai";

const QUERY = gql`
    query poapAccounts($limit: Int, $cursor: String) {
        accounts(first: $limit, orderBy: id, where: { id_gt: $cursor }) {
            id
        }
    }
`;

const Account = t.strict({
    id: t.string,
});

const Accounts = t.strict({
    accounts: t.array(Account),
});

type Accounts = t.TypeOf<typeof Accounts>;

const INFO = {
    namespace: "poap",
    name: "POAPAccount",
    version: "V1",
};

@Data({
    info: INFO,
})
class POAPAccount {
    @NonEmptyProperty()
    id: string;
}

export class POAPAccountLoader extends GraphQLDataLoaderBase<
    Accounts,
    POAPAccount
> {
    public info = INFO;

    protected batchSize = BATCH_SIZE;
    protected type = POAPAccount;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected graphQLQuery = QUERY;
    protected codec = Accounts;

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected mapResult(result: Accounts): Array<POAPAccount> {
        return result.accounts.map((account) => ({
            id: account.id,
        }));
    }

    protected extractCursor(accounts: Accounts) {
        return accounts.accounts[accounts.accounts.length - 1].id;
    }
}

export const createPOAPAccountLoader: () => POAPAccountLoader = () =>
    new POAPAccountLoader(createGraphQLClient(URL));
