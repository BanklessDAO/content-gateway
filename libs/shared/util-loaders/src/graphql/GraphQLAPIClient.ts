import { DocumentNode, OperationVariables } from "@apollo/client/core";
import TheGraphAPIClient from "./impl/TheGraphAPIClient";

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
        // TODO: use unknown instead of any
        mappingCallback: (response: any) => T
    ): Promise<T>;
}

export const createGraphQLAPIClient: (uri: string) => GraphQLAPIClient = (
    uri
) => new TheGraphAPIClient(uri);
