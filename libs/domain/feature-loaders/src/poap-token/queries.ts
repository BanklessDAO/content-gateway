import { DocumentNode } from "@apollo/client/core";
import gql from "graphql-tag";

export const POAP_TOKEN_SUBGRAPH_TOKENS: DocumentNode = gql`
    query poapTokens($count: Int, $cursor: Int) {
        tokens(first: $count, where: { created_gt: $cursor }) {
            id
            created
            owner {
                id
            }
        }
    }
`;
