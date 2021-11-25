import * as g from "graphql";

const pageInfo = new g.GraphQLObjectType({
    name: "PageInfo",
    description: "Pagination uses the _id field to paginate startCursor and endCursor point to the first and last element's _id in the result set.",
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
    new g.GraphQLNonNull(
        new g.GraphQLObjectType({
            name: `${type.name}Results`,
            description: "Wrapper object that contains the results of the query and also the possible errors, notes, and a page info object. Check PageInfo to learn how to perform pagination.",
            fields: () => ({
                pageInfo: {
                    type: g.GraphQLNonNull(pageInfo),
                    description: "Contains information necessary for pagination"
                },
                data: {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLList(new g.GraphQLNonNull(type))
                    ),
                    description: "Contains the results of the query."
                },
                notes: {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLList(g.GraphQLString)
                    ),
                    description: "Additional information about the query"
                },
                errors: {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLList(g.GraphQLString)
                    ),
                },
            }),
        })
    );

export type Results = {
    pageInfo: PageInfo;
    data: Record<string, unknown>[];
    notes: string[];
    errors: string[];
};
