import fetch from 'cross-fetch';
import {
  ApolloClient,
  HttpLink,
  DocumentNode,
  InMemoryCache,
  NormalizedCacheObject,
  OperationVariables
} from "@apollo/client/core"
import { GraphQLAPIClient } from '../interface/GraphQLAPIClient'

/**
 * GraphQL API implementation targeting the subgraph.
 */
class TheGraphAPIClient implements GraphQLAPIClient {
  private readonly client: ApolloClient<NormalizedCacheObject>

  constructor(
    uri
  ) {
    this.client = new ApolloClient({
      uri: uri,
      link: new HttpLink({ uri: uri, fetch }),
      cache: new InMemoryCache()
    })
  }

  async query<T>(
    query: DocumentNode, 
    vars: OperationVariables, 
    mappingCallback: (response: any) => T
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      this.client
      .query({
        query: query,
        variables: vars,
        //fetchPolicy: "no-cache"
      })
      .then(response => {
        console.log('TheGraph query result:')
        console.log(response)

        const mappedResult = mappingCallback(response)

        resolve(mappedResult)
      })
      .catch(err => { 
        throw new Error("Couldn't fetch subgraph data: " + err)
      })
    })
  }
}

export default TheGraphAPIClient
