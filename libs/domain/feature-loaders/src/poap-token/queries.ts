import { DocumentNode } from "@apollo/client/core";
import gql from "graphql-tag";

export const POAP_TOKEN_SUBGRAPH_TOKENS: DocumentNode = gql`
    query poapTokens($limit: Int, $cursor: String) {
        tokens(first: $limit, where: { created_gt: $cursor }) {
            id
            created
            transferCount
            owner {
                id
            }
            event {
                id
            }
        }
    }
`;

export const POAP_TOKEN_SUBGRAPH_ACCOUNTS: DocumentNode = gql`
    query poapAccounts($limit: Int, $skip: Int) {
        accounts(first: $limit, skip: $skip) {
            id
            tokensOwned
        }
    }
`;
