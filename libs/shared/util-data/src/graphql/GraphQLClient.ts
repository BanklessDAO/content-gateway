import { DocumentNode, OperationVariables } from "@apollo/client/core";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { ProgramError } from "..";
import { ApolloGraphQLClient } from "./impl";

/**
 * A GraphQL client implementation that can be used to load data
 * from remote GraphQL servers.
 */
export interface GraphQLClient {
    /**
     * Executes the given GraphQL query and returns the result.
     */
    query<T>(
        query: DocumentNode,
        vars: OperationVariables,
        codec: t.Type<T>
    ): TE.TaskEither<ProgramError, T>;
}

/**
 * Creates a new {@link GraphQLClient} instance that points to the
 * endpoint at the given URL.
 */
export const createGraphQLClient = (url: string): GraphQLClient =>
    new ApolloGraphQLClient(url);
