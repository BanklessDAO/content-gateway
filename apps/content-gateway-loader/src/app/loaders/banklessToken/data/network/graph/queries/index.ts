import { DocumentNode } from '@apollo/client/core'
import gql from 'graphql-tag';

const BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS: DocumentNode = gql`
  query banklessTokenAccounts($count: String, $offsetID: String) {
    accounts(
      first: $count, 
      where: { id_gt: $offsetID }
    ) {
      id
      ERC20balances {
        value
        valueExact
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
`

export {
  BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS
}
