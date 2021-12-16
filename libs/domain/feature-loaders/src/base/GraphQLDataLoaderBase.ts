import { GraphQLClient } from "@banklessdao/util-data";
import { DataLoaderBase, LoadContext } from "@shared/util-loaders";
import { DocumentNode } from "graphql";

export abstract class GraphQLDataLoaderBase<R, T> extends DataLoaderBase<R, T> {
    protected abstract graphQLQuery: DocumentNode;

    private client: GraphQLClient;

    constructor(client: GraphQLClient) {
        super();
        this.client = client;
    }

    protected loadRaw(context: LoadContext) {
        return this.client.query(this.graphQLQuery, context, this.codec);
    }
}
