import { get, UnknownError } from "@shared/util-dto";
import {
    createGraphQLClient,
    GraphQLClient,
    InitContext,
    LoadContext,
} from "@shared/util-loaders";
import { AdditionalProperties, Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DocumentNode } from "graphql";
import gql from "graphql-tag";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { GraphQLDataLoaderBase } from "../base/GraphQLDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const URL = "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai";

export const QUERY: DocumentNode = gql`
    query poapEvents($limit: Int, $cursor: String) {
        events(
            first: $limit
            orderBy: created
            where: { created_gt: $cursor }
        ) {
            id
            created
        }
    }
`;

export const INFO = {
    namespace: "poap",
    name: "POAPEvent",
    version: "V1",
};

@AdditionalProperties(false)
export class POAPEvent {
    @Required(true)
    id: string;
    @Required(true)
    createdAt: number;
}

const Event = t.strict({
    id: withMessage(t.string, () => "id is required"),
    created: withMessage(t.string, () => "created is required"),
});

const Events = t.strict({
    events: t.array(Event),
});

const POAPAPIEvent = t.strict({
    id: t.number,
    fancy_id: t.string,
    name: t.string,
    event_url: t.string,
    image_url: t.string,
    country: t.string,
    city: t.string,
    description: t.string,
    year: t.number,
    start_date: t.string,
    end_date: t.string,
    expiry_date: t.string,
    from_admin: t.boolean,
    virtual_event: t.boolean,
    event_template_id: t.number,
    event_host_id: t.number,
    private_event: t.boolean,
});

const POAPAPIEventResult = t.strict({
    items: t.array(
        t.intersection([
            POAPAPIEvent,
            t.partial({
                created_date: t.string,
            }),
        ])
    ),
    total: t.number,
    offset: t.number,
    limit: t.number,
});

type POAPAPIEvent = t.TypeOf<typeof POAPAPIEvent>;

type Events = t.TypeOf<typeof Events>;

export class POAPEventLoader extends GraphQLDataLoaderBase<Events, POAPEvent> {
    public info = INFO;

    protected cursorMode = "cursor" as const;
    protected batchSize = BATCH_SIZE;
    protected type = POAPEvent;
    protected cadenceConfig = {
        fullBatch: { minutes: 1 },
        partialBatch: { minutes: 5 },
    };

    protected graphQLQuery = QUERY;
    protected codec = Events;

    private poapApiEvents = [] as POAPAPIEvent[];

    constructor(client: GraphQLClient) {
        super(client);
    }

    protected preInizialize(context: InitContext) {
        return pipe(
            TE.tryCatch(
                async () => {
                    const limit = BATCH_SIZE;
                    let offset = 0;
                    let lastCount = Infinity;
                    while (lastCount >= limit) {
                        const result = await get({
                            url: `http://api.poap.xyz/paginated-events?sort_field=id&sort_dir=asc&limit=${limit}&offset=${offset}`,
                            codec: POAPAPIEventResult,
                        })();
                        if (E.isLeft(result)) {
                            throw result.left;
                        }
                        this.poapApiEvents.push(...result.right.items);
                        lastCount = result.right.items.length;
                        offset += lastCount;
                    }
                    this.logger.info(
                        `Pre-loaded a total of ${this.poapApiEvents.length} events.`
                    );
                    return context;
                },
                (e) => new UnknownError(e)
            )
        );
    }

    protected mapGraphQLResult(result: Events): Array<POAPEvent> {
        return result.events.map((event) => ({
            id: event.id,
            createdAt: parseInt(event.created),
        }));
    }

    protected getNextCursor(result: Array<POAPEvent>) {
        return result.length > 0
            ? result[result.length - 1].createdAt.toString()
            : "0";
    }
}

export const createPOAPEventLoader: () => POAPEventLoader = () =>
    new POAPEventLoader(createGraphQLClient(URL));
