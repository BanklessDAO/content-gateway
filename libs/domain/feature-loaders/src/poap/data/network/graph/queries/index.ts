import { DocumentNode } from '@apollo/client/core'
import gql from 'graphql-tag';

const POAP_TOKEN_SUBGRAPH_TOKENS: DocumentNode = gql`
  query poapTokens($count: Int, $offsetID: String) {
    tokens(
      first: $count, 
      where: { id_gt: $offsetID }
    ) {
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
