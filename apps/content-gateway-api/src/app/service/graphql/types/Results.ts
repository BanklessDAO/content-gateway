import * as g from "graphql";

const pageInfo = new g.GraphQLObjectType({
    name: "PageInfo",
    fields: {
        hasNextPage: {
            type: new g.GraphQLNonNull(g.GraphQLBoolean),
            description: "Tells whether there are more pages after endCursor.",
        },
        startCursor: {
            type: new g.GraphQLNonNull(g.GraphQLString),
            description: "Points to the first element on the page.",
        },
        endCursor: {
            type: new g.GraphQLNonNull(g.GraphQLString),
            description: "Points to the last element on the page.",
        },
    },
});

export type PageInfo = {
    hasNextPage: boolean;
    startCursor: string;
    endCursor: string;
};

export const createResultsType = (type: g.GraphQLObjectType) =>
    new g.GraphQLObjectType({
        name: `${type.name}Results`,
        fields: () => ({
            pageInfo: {
                type: pageInfo,
            },
            data: {
                type: new g.GraphQLNonNull(
                    new g.GraphQLList(new g.GraphQLNonNull(type))
                ),
            },
            notes: {
                type: new g.GraphQLNonNull(new g.GraphQLList(g.GraphQLString)),
            },
            errors: {
                type: new g.GraphQLNonNull(new g.GraphQLList(g.GraphQLString)),
            },
        }),
    });

export type Results = {
    pageInfo: PageInfo;
    data: Record<string, unknown>[];
    notes: string[];
    errors: string[];
};
