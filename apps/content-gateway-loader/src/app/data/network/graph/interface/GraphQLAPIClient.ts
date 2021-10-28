import { DocumentNode, OperationVariables } from '@apollo/client/core'

/**
 * Abstract GraphQL API client
 * @property {GraphQLAPIMapper} mapper Model mapper
 */
export interface GraphQLAPIClient {
  /**
   * Universal query.
   */
  query<T>(
    query: DocumentNode, 
    vars: OperationVariables, 
    mappingCallback: (response: any) => T
  ): Promise<T>
}