import {
    ApolloClient,
    DocumentNode,
    HttpLink,
    InMemoryCache,
    NormalizedCacheObject,
    OperationVariables
} from "@apollo/client/core";
import fetch from "cross-fetch";
import { GraphQLAPIClient } from "..";

/**
 * GraphQL API implementation targeting the subgraph.
 */
class TheGraphAPIClient implements GraphQLAPIClient {
    private readonly client: ApolloClient<NormalizedCacheObject>;

    constructor(uri: string) {
        this.client = new ApolloClient({
            uri: uri,
            link: new HttpLink({ uri: uri, fetch }),
            cache: new InMemoryCache({
                addTypename: false
            }),
        });
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
                    fetchPolicy: "no-cache"
                })
                .then((response) => {
                    if (response.loading == true || response.partial || response.data === undefined) { return }
                    console.log(`Is loading: ${ response.loading }`)
                    const mappedResult = mappingCallback(response.data);
                    resolve(mappedResult);
                })
                .catch((err) => {
                    throw new Error("Couldn't complete subgraph data fetch and/or mapping: " + err);
                });
        });
    }
}

export default TheGraphAPIClient;
