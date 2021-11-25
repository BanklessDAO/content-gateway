import { DocumentNode, OperationVariables } from "@apollo/client/core";
import { ProgramError } from "@shared/util-dto";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { TheGraphClient as TheGraphClient } from "./impl/TheGraphClient";

/**
 *
 */
export interface GraphQLClient {
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
    new TheGraphClient(url);
