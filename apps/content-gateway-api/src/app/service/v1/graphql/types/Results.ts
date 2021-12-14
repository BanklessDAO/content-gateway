import * as g from "graphql";

const pageInfo = new g.GraphQLObjectType({
    name: "PageInfo",
    description: `
    Pagination uses opaque strings (tokens) that contain information about how to access the next page.
    If the value of \`hasNextPage\` is \`true\` it means that there is a next page.
    If you want to access it you'll have to pass \`nextPageToken\` as the \`after\` parameter.
    `,
    fields: {
        hasNextPage: {
            type: new g.GraphQLNonNull(g.GraphQLBoolean),
            description:
                "Tells whether there are more pages after the current one.",
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
                "Pass this token in your next query as the value for the `after` parameter to access the next page.",
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
                    description: "If there were errors during the execution of the query you'll be able to see them here."
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
