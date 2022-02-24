import {
    createGraphQLClient,
    GraphQLClient,
    ProgramError,
    UnknownError,
} from "@banklessdao/util-data";
import { LoadContext, ScheduleMode } from "@shared/util-loaders";
import {
    Data,
    Nested,
    NonEmptyProperty,
    OptionalNumberArrayOf,
    OptionalObjectRef,
    OptionalProperty,
    RequiredArrayRef,
    RequiredStringArrayOf,
} from "@banklessdao/util-schema";
import gql from "graphql-tag";
import * as t from "io-ts";
import * as E from "fp-ts/lib/Either";
import * as TE from "fp-ts/lib/TaskEither";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";
import { withMessage } from "io-ts-types";
import { optional } from "@banklessdao/util-data";
import { TaskEither } from "fp-ts/lib/TaskEither";

export const URL = "https://hub.snapshot.org/graphql";

export const QUERY = gql`
    query snapshotProposals($limit: Int, $cursor: Int, $spaces: [String]) {
        proposals(
            first: $limit
            where: { space_in: $spaces }
            skip: $cursor
            orderBy: "created"
            orderDirection: asc
        ) {
            id
            strategies {
                name
                params
            }
            title
            body
            choices
            created
            start
            end
            snapshot
            state
            author
            space {
                id
                name
            }
        }
    }
`;

export const ProposalCodec = t.strict({
    id: t.string,
    author: t.string,
    created: t.number,
    space: optional(
        t.strict({
            id: t.string,
            name: t.string,
        })
    ),
    type: optional(t.string),
    strategies: withMessage(
        t.array(
            t.strict({
                name: t.string,
            })
        ),
        () => "strategies failed"
    ),
    title: t.string,
    body: optional(t.string),
    choices: t.array(t.string),
    start: t.number,
    end: t.number,
    snapshot: t.string,
    state: t.string,
    link: optional(t.string),
    scores: optional(t.array(t.number)),
    votes: optional(t.number),
});

export const ProposalsCodec = t.strict({
    proposals: t.array(ProposalCodec),
});

export type Proposals = t.TypeOf<typeof ProposalsCodec>;

const INFO = {
    namespace: "snapshot",
    name: "Proposal",
    version: "V1",
};
@Nested()
class Space {
    @OptionalProperty()
    name: string;
    @NonEmptyProperty()
    id: string;
}

@Nested()
class Strategy {
    @NonEmptyProperty()
    name: string;
}

@Data({
    info: INFO,
})
export class Proposal {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    author: string;
    @NonEmptyProperty()
    created: number;
    @OptionalObjectRef(Space)
    space?: Space;
    @OptionalProperty()
    type?: string;
    @RequiredArrayRef(Strategy)
    strategies: Strategy[];
    @NonEmptyProperty()
    title: string;
    @OptionalProperty()
    body?: string;
    @RequiredStringArrayOf()
    choices: string[];
    @NonEmptyProperty()
    start: number;
    @NonEmptyProperty()
    end: number;
    @NonEmptyProperty()
    snapshot: string;
    @NonEmptyProperty()
    state: string;
    @OptionalProperty()
    link?: string;
    @OptionalNumberArrayOf()
    scores?: number[];
    @OptionalProperty()
    votes: number;
}

export class SnapshotProposalLoader extends GraphQLDataLoaderBase<
    Proposals,
    Proposal
> {
    public info = INFO;

    protected cursorMode = "cursor" as const;
    protected cursor: number;

    protected batchSize = BATCH_SIZE;
    protected type = Proposal;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected graphQLQuery = QUERY;
    protected codec = ProposalsCodec;

    protected spaces: string[];

    constructor(client: GraphQLClient, spaces: string[]) {
        super(client);
        this.spaces = spaces;
    }

    protected mapResult(result: Proposals): Array<Proposal> {
        return result.proposals as Array<Proposal>;
    }

    protected extractCursor = (proposals: Proposals) => {
        return String(this.cursor + proposals.proposals.length);
    };

    /**
     * Safely record the cursor before loading so that we can use it to find the next cursor
     */
    protected preLoad = (
        context: LoadContext
    ): TaskEither<ProgramError, LoadContext> => {
        const setCursor = () => {
            this.cursor = Number(context.cursor);
            if (isNaN(this.cursor))
                throw new Error("Failed to convert cursor to number");
            return context;
        };
        return TE.fromEither(E.tryCatch(setCursor, (e) => new UnknownError(e)));
    };

    /**
     * Add spaces to context and convert cursor to number
     */
    protected extractQueryContext = (context: LoadContext) => {
        const convertContext = () => ({
            ...context,
            cursor: Number(context.cursor),
            spaces: this.spaces,
        });
        return E.tryCatch(convertContext, (e) => new UnknownError(e));
    };
}

export const createSnapshotProposalLoader: (
    spaces: string[]
) => SnapshotProposalLoader = (spaces) =>
    new SnapshotProposalLoader(createGraphQLClient(URL), spaces);
