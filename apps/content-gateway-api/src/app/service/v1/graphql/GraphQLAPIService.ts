import {
    DataRepository,
    Filter,
    FilterType,
    OrderBy,
    Query
} from "@domain/feature-gateway";
import { createLogger } from "@shared/util-fp";
import { toGraphQLType } from "@shared/util-graphql";
import { Schema, SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import { Request, Response } from "express";
import { graphqlHTTP } from "express-graphql";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { map } from "fp-ts/lib/Identity";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import * as g from "graphql";
import { pascalCase } from "pascal-case";
import { liveLoaders } from "../../../live-loaders";
import { MAX_ITEMS } from "./constants";
import { ObservableSchemaRepository } from "./decorator";
import { AnyFilter, createFiltersFor } from "./types/Filters";
import { createResultsType, Results } from "./types/Results";

export type GraphQLAPIService = {
    readonly middleware: Middleware;
};

type SchemaGQLTypePair = [Schema, g.GraphQLObjectType];

type Middleware = (request: Request, response: Response) => Promise<void>;

type Deps = {
    readonly schemaRepository: ObservableSchemaRepository;
    readonly dataRepository: DataRepository;
};

type QueryMapping = {
    [namespace: string]: g.GraphQLFieldConfigMap<string, unknown>;
};

/**
 * Creates a new GraphQL API that can be used as an Express middleware.
 */
export const createGraphQLAPIV1 = async (
    deps: Deps
): Promise<Middleware> => {
    let currentMiddleware = await createGraphQLMiddleware(deps);
    deps.schemaRepository.onChange(() => {
        createGraphQLMiddleware(deps).then((middleware) => {
            currentMiddleware = middleware;
        });
    });
    return (request: Request, response: Response): Promise<void> => {
        return currentMiddleware(request, response);
    };
};

const orderByType = new g.GraphQLInputObjectType({
    name: "OrderBy",
    fields: {
        fieldPath: { type: g.GraphQLString },
        direction: {
            type: new g.GraphQLEnumType({
                name: "Direction",
                values: {
                    asc: { value: "asc" },
                    desc: { value: "desc" },
                },
            }),
        },
    },
});

const mapFilters = (from: Record<string, AnyFilter>): Filter[] => {
    return Object.entries(from).reduce((acc, next) => {
        const [fieldName, filter] = next;
        Object.entries(filter).forEach(([filterType, value]) => {
            acc.push({
                fieldPath: fieldName,
                type: filterType as FilterType,
                value: value,
            });
        });
        return acc;
    }, [] as Filter[]);
};

const createGraphQLMiddleware = async ({
    schemaRepository,
    dataRepository,
}: Deps): Promise<Middleware> => {
    const logger = createLogger("GraphQLAPI");
    const schemas = await schemaRepository.findAll()();
    const str = schemas.map((schema) => schemaInfoToString(schema.info)).join();
    logger.info(`Current schemas are: ${str}`);

    const findById = async (info: SchemaInfo, id: string) => {
        return pipe(
            dataRepository.findById(info, id),
            TO.map((data) => data.record),
            TO.getOrElse(() => T.of({} as Record<string, unknown>))
        )();
    };

    const findByFilters = async (params: {
        info: SchemaInfo;
        first: number;
        after?: string;
        where?: Filter[];
        orderBy?: OrderBy;
    }): Promise<Results> => {
        const { info, first, after, where, orderBy } = params;
        const notes = [] as string[];
        let limit = first;
        if (limit > MAX_ITEMS) {
            limit = MAX_ITEMS;
            notes.push(
                `The requested amount of items (${first}) is greater than the allowed maximum (${MAX_ITEMS}). Setting after to ${MAX_ITEMS}.`
            );
        }

        const query: Query = { info, limit };
        if (after) {
            query.cursor = after;
        }
        if (where) {
            query.where = where;
        }
        if (orderBy) {
            query.orderBy = orderBy;
        }

        return pipe(
            dataRepository.findByQuery(query),
            TE.map((entryList) => {
                const entries = entryList.entries;
                const hasNextPage = entryList.nextPageToken !== undefined;
                const nextPageToken = entryList.nextPageToken;
                return {
                    pageInfo: {
                        hasNextPage,
                        nextPageToken,
                        //! 👇 deprecated
                        endCursor: nextPageToken,
                    },
                    errors: [],
                    notes: notes,
                    data: entries.map((entry) => ({
                        ...entry.record,
                    })),
                };
            }),
            TE.getOrElse((e) => {
                logger.info("Errors:", e);
                return T.of({
                    pageInfo: {
                        hasNextPage: false,
                    },
                    errors: [e.message],
                    notes: [] as string[],
                    data: [] as Record<string, unknown>[],
                });
            })
        )();
    };

    const createOperations = (
        schema: Schema,
        type: g.GraphQLObjectType<unknown, unknown>
    ): [SchemaInfo, g.GraphQLFieldConfigMap<string, unknown>] => {
        const info = schema.info;
        return [
            info,
            {
                [type.name]: {
                    type: type,
                    args: {
                        id: { type: g.GraphQLString },
                    },
                    resolve: async (_, args) => {
                        const { id } = args as {
                            id: string;
                        };
                        return findById(info, id);
                    },
                },
                [`${type.name}s`]: {
                    type: createResultsType(type),
                    description: `Returns a list of ${type.name}s. Supports pagination and filtering.`,
                    args: {
                        first: {
                            type: g.GraphQLInt,
                            defaultValue: MAX_ITEMS,
                            description: `Limits the amount of items returned.
                             Note that if there are less items than \`after\`, all items will be returned (you might get less items than the value you passed to after).`,
                        },
                        after: {
                            type: g.GraphQLString,
                            description: `**(Optional)** The cursor that you can use to access the next page of items.
                            You can obtain this value from the \`pageInfo\` field of the response. (\`nextPageToken\`).
                            See the results type for more information on pagination.`,
                        },
                        orderBy: {
                            type: orderByType,
                            description: `**(Optional)** Sets the ordering of the items returned. You can order by top level fields (eg: you can't use \`"fieldA.fieldB"\` for now).`,
                        },
                        where: {
                            type: createFiltersFor(
                                type.name,
                                schema.jsonSchema
                            ),
                            defaultValue: {},
                            description: `**(Optional)** Filters the items returned.
                             All filters have to be **true** for each item in the collection (this is an AND filter).
                             See the results type for more information on filtering.`,
                        },
                    },
                    resolve: (_, args) => {
                        const { first, after, orderBy, where } = args as {
                            first: number;
                            after: string;
                            where: Record<string, AnyFilter>;
                            orderBy: OrderBy;
                        };
                        return findByFilters({
                            info: schema.info,
                            first: first,
                            after: after,
                            orderBy: orderBy,
                            where: mapFilters(where),
                        });
                    },
                },
            },
        ];
    };

    return pipe(
        schemas,
        A.map(
            (schema: Schema) =>
                [schema, toGraphQLType(schema)] as SchemaGQLTypePair
        ),
        A.map(
            ([schema, type]): [
                SchemaInfo,
                g.GraphQLFieldConfigMap<string, unknown>
            ] => {
                return createOperations(schema, type);
            }
        ),
        A.reduce({} as QueryMapping, (acc, curr) => {
            const [info, fields] = curr;
            const namespaceKey = pascalCase(info.namespace) + info.version;
            return {
                ...acc,
                ...{
                    [namespaceKey]: {
                        ...acc[namespaceKey],
                        ...fields,
                    },
                },
            };
        }),
        map((mapping) => {
            const fields = {} as g.GraphQLFieldConfigMap<string, unknown>;
            for (const [namespace, operations] of Object.entries(mapping)) {
                fields[namespace] = {
                    type: new g.GraphQLNonNull(
                        new g.GraphQLObjectType({
                            name: namespace,
                            fields: operations,
                        })
                    ),
                    resolve: () => {
                        return {};
                    },
                };
            }

            const liveFields = liveLoaders
                .map((loader) => loader.configure())
                .reduce((acc, next) => {
                    return {
                        ...acc,
                        ...next,
                    };
                }, {});
            return new g.GraphQLSchema({
                query: new g.GraphQLObjectType({
                    name: "Query",
                    fields: {
                        historical: {
                            type: new g.GraphQLNonNull(
                                new g.GraphQLObjectType({
                                    name: "historical",
                                    fields: fields,
                                    description: `Historical queries return data that might not be up to date.
                                    This usually means that the data you see was updated 5-10 minutes ago.
                                    Queries are grouped into namespaces.`,
                                })
                            ),
                            description:
                                "Contains all the queries that operate on historical data that might not be up to date",
                            resolve: () => {
                                return {};
                            },
                        },
                        live: {
                            type: new g.GraphQLNonNull(
                                new g.GraphQLObjectType({
                                    name: "live",
                                    fields: liveFields,
                                    description: `Live queries return up to date data, but don't support filtering or ordering.`,
                                })
                            ),
                            description:
                                "Contains all the queries that operate on live data that are up to date",
                            resolve: () => {
                                return {};
                            },
                        },
                    },
                    description:
                        "Contains all the queries that can be executed against the Content Gateway API.",
                }),
            });
        }),
        map((schema) => {
            return graphqlHTTP({
                schema: schema,
                graphiql: true,
            });
        })
    );
};
