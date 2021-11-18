import { DocumentNode } from "@apollo/client/core";
import gql from "graphql-tag";

export const BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS: DocumentNode = gql`
    query banklessTokenAccounts($limit: Int, $cursor: String) {
        accounts(
            first: $limit
            orderBy: lastTransactionTimestamp
            where: { lastTransactionTimestamp_gt: $cursor }
        ) {
            id
            lastTransactionTimestamp
            ERC20balances {
                value
                transferToEvent {
                    value
                    from {
                        id
                    }
                    to {
                        id
                    }
                }
                transferFromEvent {
                    value
                    from {
                        id
                    }
                    to {
                        id
                    }
                }
            }
        }
    }
`;
