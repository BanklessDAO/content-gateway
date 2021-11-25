import {
    DataLoaderBase,
    GraphQLClient,
    LoadContext
} from "@shared/util-loaders";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DocumentNode } from "graphql";
import * as t from "io-ts";

export type CursorMode = "skip" | "cursor";

export abstract class GraphQLDataLoaderBase<G, T> extends DataLoaderBase<T> {
    protected abstract graphQLQuery: DocumentNode;
    protected abstract codec: t.Type<G>;
    protected abstract cursorMode: CursorMode;

    private client: GraphQLClient;

    constructor(client: GraphQLClient) {
        super();
        this.client = client;
    }

    protected abstract mapGraphQLResult(result: G): Array<T>;
    protected abstract getNextCursor(
        result: Array<T>,
        loadContext: LoadContext
    ): string;

    public load(context: LoadContext) {
        const { cursor, limit } = context;
        const params: Record<string, unknown> = {
            limit,
        };
        switch (this.cursorMode) {
            case "skip":
                params.skip = parseInt(cursor ?? "0");
                break;
            case "cursor":
                params.cursor = cursor ?? "0";
                break;
        }
        return pipe(
            this.client.query(this.graphQLQuery, params, this.codec),
            TE.map(this.mapGraphQLResult),
            TE.map((data) => {
                return {
                    cursor: this.getNextCursor(data, context),
                    data: data,
                };
            })
        );
    }
}
