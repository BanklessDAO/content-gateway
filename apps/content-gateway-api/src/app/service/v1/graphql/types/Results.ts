import * as g from "graphql";

const pageInfo = new g.GraphQLObjectType({
    name: "PageInfo",
    description: `
    Pagination uses opaque strings (tokens) that contain information about how to access the next page.
    Use the \`nextPageToken\` field to access the next page.
    \`hasNextPage\` is true if a next page exists. In this case \`nextPageToken\` contains the token that
    you can pass to access the next page.
    `,
    fields: {
        hasNextPage: {
            type: new g.GraphQLNonNull(g.GraphQLBoolean),
            description:
                "Tells whether there are more pages after the current one..",
        },
        startCursor: {
            type: g.GraphQLString,
            deprecationReason:
                "Backwards paging is not implemented yet, don't use this.",
        },
        endCursor: {
            type: g.GraphQLString,
            deprecationReason: "Deprecated, use nextPageToken instead.",
        },
        nextPageToken: {
            type: g.GraphQLString,
            description:
                "Use this token in your next request to access the next page.",
        },
    },
});

export type PageInfo = {
    hasNextPage: boolean;
    endCursor?: string;
    nextPageToken?: string;
};

export const createResultType = (type: g.GraphQLObjectType) =>
    new g.GraphQLNonNull(
        new g.GraphQLObjectType({
            name: `${type.name}Result`,
            description:
                "Wrapper object that contains the result of the query and also the possible errors and notes.",
            fields: () => ({
                data: {
                    type: type,
                    description: "Contains the result of the query.",
                },
                notes: {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLList(g.GraphQLString)
                    ),
                    description: "Additional information about the query",
                },
                errors: {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLList(g.GraphQLString)
                    ),
                },
            }),
        })
    );

export const createResultsType = (type: g.GraphQLObjectType) =>
    new g.GraphQLNonNull(
        new g.GraphQLObjectType({
            name: `${type.name}Results`,
            description: `
            Wrapper object that contains the results of the query and also the possible errors, notes, and a page info object.
            Check \`pageInfo\` to learn how to perform pagination.`,
            fields: () => ({
                pageInfo: {
                    type: g.GraphQLNonNull(pageInfo),
                    description:
                        "Contains information necessary for pagination",
                },
                data: {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLList(new g.GraphQLNonNull(type))
                    ),
                    description: "Contains the results of the query.",
                },
                notes: {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLList(g.GraphQLString)
                    ),
                    description: "Additional information about the query",
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
