import { get } from "@shared/util-data";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { LiveLoader } from "./LiveLoader";
import * as g from "graphql";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { createResultType } from "../service/v1/graphql/types/Results";
import { pipe } from "fp-ts/lib/function";

const name = "POAPToken";

const GraphQLPOAPToken = new g.GraphQLObjectType({
    name: name,
    fields: {
        event: {
            type: new g.GraphQLObjectType({
                name: "POAPEvent",
                fields: {
                    id: { type: new g.GraphQLNonNull(g.GraphQLID) },
                    fancy_id: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    name: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    event_url: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    image_url: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    country: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    city: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    description: {
                        type: new g.GraphQLNonNull(g.GraphQLString),
                    },
                    year: { type: new g.GraphQLNonNull(g.GraphQLInt) },
                    start_date: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    end_date: { type: new g.GraphQLNonNull(g.GraphQLString) },
                    expiry_date: {
                        type: new g.GraphQLNonNull(g.GraphQLString),
                    },
                    created_date: { type: g.GraphQLString },
                    supply: { type: g.GraphQLInt },
                },
            }),
        },
        tokenId: { type: new g.GraphQLNonNull(g.GraphQLString) },
        owner: { type: new g.GraphQLNonNull(g.GraphQLString) },
        created: { type: g.GraphQLString },
        supply: { type: g.GraphQLInt },
    },
});

const GraphQLPOAPTokens = new g.GraphQLObjectType({
    name: "POAPTokens",
    fields: {
        tokens: {
            type: new g.GraphQLNonNull(new g.GraphQLList(GraphQLPOAPToken)),
        },
    },
});

const resultCodec = t.array(
    t.intersection([
        t.strict({
            event: t.intersection([
                t.strict({
                    id: withMessage(t.number, () => "id is required"),
                    fancy_id: withMessage(
                        t.string,
                        () => "fancy_id is required"
                    ),
                    name: withMessage(t.string, () => "name is required"),
                    event_url: withMessage(
                        t.string,
                        () => "event_url is required"
                    ),
                    image_url: withMessage(
                        t.string,
                        () => "image_url is required"
                    ),
                    country: withMessage(t.string, () => "country is required"),
                    city: withMessage(t.string, () => "city is required"),
                    description: withMessage(
                        t.string,
                        () => "description is required"
                    ),
                    year: withMessage(t.number, () => "year is required"),
                    start_date: withMessage(
                        t.string,
                        () => "start_date is required"
                    ),
                    end_date: withMessage(
                        t.string,
                        () => "end_date is required"
                    ),
                    expiry_date: withMessage(
                        t.string,
                        () => "expiry_date is required"
                    ),
                }),
                t.partial({
                    created_date: t.string,
                    supply: t.number,
                }),
            ]),
            tokenId: withMessage(t.string, () => "tokenId is required"),
            owner: withMessage(t.string, () => "owner is required"),
            created: t.union([t.string, t.null]),
        }),
        t.partial({
            supply: t.number,
        }),
    ])
);

type Result = t.TypeOf<typeof resultCodec>;

const paramsCodec = t.strict({
    address: t.string,
});

type Params = t.TypeOf<typeof paramsCodec>;

export const createLivePOAPTokenLoader = (): LiveLoader<Params, Result> => {
    const load = (params: Params) => {
        const url = `http://api.poap.xyz/actions/scan/${params.address}`;
        return get({ url, codec: resultCodec });
    };
    return {
        configure: () => {
            return {
                [name]: {
                    type: createResultType(GraphQLPOAPTokens),
                    args: {
                        address: { type: g.GraphQLString },
                    },
                    resolve: async (_, args) => {
                        return pipe(
                            paramsCodec.decode(args),
                            TE.fromEither,
                            TE.chainW(load),
                            TE.map((tokens) => {
                                return {
                                    errors: [],
                                    notes: [],
                                    data: { tokens },
                                };
                            }),
                            TE.getOrElse((e) =>
                                T.of({
                                    errors: [e.toString()],
                                    notes: [] as string[],
                                    data: {
                                        tokens: {},
                                    },
                                })
                            )
                        )();
                    },
                },
            };
        },
        load: load,
    };
};
