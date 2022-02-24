import { GraphQLClient, ProgramError } from "@banklessdao/util-data";
import { CodecDataLoaderBase, LoadContext } from "@shared/util-loaders";
import { Either } from "fp-ts/lib/Either";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { DocumentNode } from "graphql";

export abstract class GraphQLDataLoaderBase<R, T> extends CodecDataLoaderBase<R, T> {
    protected abstract graphQLQuery: DocumentNode;

    private client: GraphQLClient;

    constructor(client: GraphQLClient) {
        super();
        this.client = client;
    }

    protected loadRaw(context: LoadContext) {
        return pipe(
            context,
            this.extractQueryContext,
            TE.fromEither,
            TE.chain((c)=> this.client.query(this.graphQLQuery, c, this.codec))
        )
    }

    /**
     * Override this method to modify or add fields to the GQL query context
     */
    protected extractQueryContext(context: LoadContext): Either<ProgramError,Record<string, unknown>> {
        return E.right(context)
    }
}
