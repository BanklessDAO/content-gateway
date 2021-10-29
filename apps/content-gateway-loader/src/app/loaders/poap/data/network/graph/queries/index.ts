import { DocumentNode } from '@apollo/client/core'
import gql from 'graphql-tag';

const POAP_TOKEN_SUBGRAPH_TOKENS: DocumentNode = gql`
  query poapTokens($count: String, $offsetID: String) {
    tokens {
      id
      created
      owner {
        id
      }
    }
  }
`

export {
  POAP_TOKEN_SUBGRAPH_TOKENS
}
