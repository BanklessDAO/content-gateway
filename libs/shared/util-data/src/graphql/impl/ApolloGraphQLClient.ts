import {
    ApolloClient,
    DocumentNode,
    HttpLink,
    InMemoryCache,
    NormalizedCacheObject,
    OperationVariables
} from "@apollo/client/core";
import {
    mapCodecValidationError,
    ProgramError,
    UnknownError
} from "@shared/util-data";
import fetch from "cross-fetch";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as t from "io-ts";
import { GraphQLClient } from "..";

export class ApolloGraphQLClient implements GraphQLClient {
    private readonly client: ApolloClient<NormalizedCacheObject>;

    constructor(uri: string) {
        this.client = new ApolloClient({
            uri: uri,
            link: new HttpLink({ uri: uri, fetch }),
            cache: new InMemoryCache({
                addTypename: false,
            }),
        });
    }

    query<T>(
        query: DocumentNode,
        vars: OperationVariables,
        codec: t.Type<T>
    ): TE.TaskEither<ProgramError, T> {
        return pipe(
            TE.tryCatch(
                async () => {
                    return this.client.query({
                        query: query,
                        variables: vars,
                        fetchPolicy: "no-cache",
                    });
                },
                (e) => new UnknownError(e)
            ),
            TE.chainW((response) => {
                return TE.fromEither(
                    pipe(
                        codec.decode(response.data),
                        mapCodecValidationError(
                            "Validating GraphQL result failed."
                        )
                    )
                );
            })
        );
    }
}
