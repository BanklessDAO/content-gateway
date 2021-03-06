import { createGraphQLClient } from "@banklessdao/util-data";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as g from "graphql";
import gql from "graphql-tag";
import * as t from "io-ts";
import { createResultType } from "../service/v1/graphql/types/Results";
import { LiveLoader } from "./LiveLoader";

const query = gql`
    query account($address: ID!) {
        account(id: $address) {
            id
            lastTransactionTimestamp
        }
        erc20Balances(where: { account: $address }) {
            value
        }
        fromTransfers: erc20Transfers(
            orderBy: timestamp
            orderDirection: desc
            where: { from: $address }
        ) {
            from {
                id
            }
            to {
                id
            }
            value
        }
        toTransfers: erc20Transfers(
            orderBy: timestamp
            orderDirection: desc
            where: { to: $address }
        ) {
            from {
                id
            }
            to {
                id
            }
            value
        }
    }
`;

const name = "BanklessToken";

const GraphQLTransfer = new g.GraphQLObjectType({
    name: "LiveBanklessTransfer",
    fields: {
        from: {
            type: new g.GraphQLObjectType({
                name: "LIveBanklessTransferFrom",
                fields: {
                    id: { type: new g.GraphQLNonNull(g.GraphQLString) },
                },
            }),
        },
        to: {
            type: new g.GraphQLObjectType({
                name: "LiveBanklessTransferTo",
                fields: {
                    id: { type: new g.GraphQLNonNull(g.GraphQLString) },
                },
            }),
        },
        value: { type: new g.GraphQLNonNull(g.GraphQLString) },
    },
});

const GraphQLBanklessToken = new g.GraphQLObjectType({
    name: name,
    fields: {
        account: {
            type: new g.GraphQLObjectType({
                name: "LiveBanklessAccount",
                fields: {
                    id: { type: new g.GraphQLNonNull(g.GraphQLID) },
                    lastTransactionTimestamp: {
                        type: new g.GraphQLNonNull(g.GraphQLString),
                    },
                },
            }),
        },
        erc20Balances: {
            type: new g.GraphQLNonNull(
                new g.GraphQLList(
                    new g.GraphQLNonNull(
                        new g.GraphQLObjectType({
                            name: "LiveBanklessErc20Balance",
                            fields: {
                                value: {
                                    type: new g.GraphQLNonNull(g.GraphQLString),
                                },
                            },
                        })
                    )
                )
            ),
        },
        fromTransfers: {
            type: new g.GraphQLNonNull(
                new g.GraphQLList(new g.GraphQLNonNull(GraphQLTransfer))
            ),
        },
        toTransfers: {
            type: new g.GraphQLNonNull(
                new g.GraphQLList(new g.GraphQLNonNull(GraphQLTransfer))
            ),
        },
    },
});

const transfer = t.strict({
    from: t.union([t.null, t.strict({ id: t.string })]),
    to: t.union([t.null, t.strict({ id: t.string })]),
    value: t.string,
});

const resultCodec = t.strict({
    account: t.union([
        t.strict({
            id: t.string,
            lastTransactionTimestamp: t.string,
        }),
        t.null,
    ]),
    erc20Balances: t.array(
        t.strict({
            value: t.string,
        })
    ),
    fromTransfers: t.array(transfer),
    toTransfers: t.array(transfer),
});

type Result = t.TypeOf<typeof resultCodec>;

const paramsCodec = t.strict({
    address: t.string,
});

type Params = t.TypeOf<typeof paramsCodec>;

export const createLiveBanklessTokenLoader = (): LiveLoader<Params, Result> => {
    const client = createGraphQLClient(
        "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph"
    );
    const load = (params: Params) => {
        return client.query(query, params, resultCodec);
    };
    return {
        configure: () => {
            return {
                [name]: {
                    type: createResultType(GraphQLBanklessToken),
                    args: {
                        address: { type: g.GraphQLString },
                    },
                    resolve: async (_, args) => {
                        return pipe(
                            paramsCodec.decode(args),
                            TE.fromEither,
                            TE.chainW(load),
                            TE.map((account) => {
                                return {
                                    errors: [],
                                    notes: [],
                                    data: account,
                                };
                            }),
                            TE.getOrElse((e) =>
                                T.of({
                                    errors: [e.toString()],
                                    notes: [] as string[],
                                    data: {},
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
