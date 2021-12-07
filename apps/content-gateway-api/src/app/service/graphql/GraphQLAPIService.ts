import { DataRepository, Filter, FilterType } from "@domain/feature-gateway";
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
import * as pluralize from "pluralize";
import { MAX_ITEMS } from "./constants";
import { ObservableSchemaRepository } from "./decorator";
import { AnyFilter, createFiltersFor } from "./types/Filters";
import { createResultsType, Results } from "./types/Results";

type SchemaGQLTypePair = [Schema, g.GraphQLObjectType];

export type Middleware = (
    request: Request,
    response: Response
) => Promise<void>;

export type Deps = {
    readonly schemaRepository: ObservableSchemaRepository;
    readonly dataRepository: DataRepository;
};

export type GraphQLAPIService = {
    readonly middleware: Middleware;
};

type QueryMapping = {
    [namespace: string]: g.GraphQLFieldConfigMap<string, unknown>;
};

/**
 * Creates a new GraphQL API that can be used as an Express middleware.
 */
export const createGraphQLAPIService = async (
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

    const findById = async (info: SchemaInfo, id: bigint) => {
        return pipe(
            // TODO! bigint 👇
            dataRepository.findById(info, id.toString()),
            TO.map((data) => data.record),
            TO.getOrElse(() => T.of({} as Record<string, unknown>))
        )();
    };

    const findByFilters = async (
        schema: Schema,
        first: number,
        after: string,
        where: Filter[]
    ): Promise<Results> => {
        const notes = [] as string[];
        let limit = first;
        if (limit > MAX_ITEMS) {
            limit = MAX_ITEMS;
            notes.push(
                `The requested amount of items (${first}) is greater than the allowed maximum (${MAX_ITEMS}). Setting after to ${MAX_ITEMS}.`
            );
        }
        // 👇 We do this to determine whether there is a next page or not.
        limit++;

        return pipe(
            dataRepository.findByQuery({
                info: schema.info,
                cursor: after ? after : undefined,
                limit: limit,
                where: where ?? [],
            }),
            TE.map((entryList) => {
                // TODO: write tests for this paging stuff
                const entries = entryList.entries;
                const hasNextPage = entries.length === limit;
                const hasEntries = entries.length > 0;
                let startCursor: string;
                let endCursor: string;
                if (hasNextPage) {
                    // 👇 We only needed this for hasNextPage.
                    entries.pop();
                }
                if (hasEntries) {
                    startCursor = entries[0].id.toString();
                    endCursor = entries[entries.length - 1].id.toString();
                } else {
                    startCursor = after ?? "";
                    endCursor = startCursor;
                }
                return {
                    pageInfo: {
                        hasNextPage,
                        startCursor: startCursor,
                        endCursor: endCursor,
                    },
                    errors: [],
                    notes: notes,
                    data: entries.map((entry) => ({
                        ...entry.record,
                        _id: entry.id.toString(),
                    })),
                };
            }),
            TE.getOrElse((e) =>
                T.of({
                    pageInfo: {
                        hasNextPage: false,
                        startCursor: "0",
                        endCursor: "0",
                    },
                    errors: [e.message],
                    notes: [] as string[],
                    data: [] as Record<string, unknown>[],
                })
            )
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
                        id: { type: g.GraphQLInt },
                    },
                    resolve: async (_, args) => {
                        const { id } = args as {
                            id: bigint;
                        };
                        return findById(info, id);
                    },
                },
                [pluralize.plural(type.name)]: {
                    type: createResultsType(type),
                    description: `Returns a list of ${type.name}s. Supports pagination and filtering.`,
                    args: {
                        first: {
                            type: g.GraphQLInt,
                            defaultValue: MAX_ITEMS,
                        },
                        after: {
                            type: g.GraphQLString,
                            defaultValue: "0",
                        },
                        where: {
                            type: createFiltersFor(
                                type.name,
                                schema.jsonSchema
                            ),
                            defaultValue: {},
                        },
                    },
                    resolve: (_, args) => {
                        const { first, after, where } = args as {
                            first: number;
                            after: string;
                            where: Record<string, AnyFilter>;
                        };
                        return findByFilters(
                            schema,
                            first,
                            after,
                            mapFilters(where)
                        );
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
            return new g.GraphQLSchema({
                query: new g.GraphQLObjectType({
                    name: "Query",
                    fields: {
                        historical: {
                            type: new g.GraphQLNonNull(
                                new g.GraphQLObjectType({
                                    name: "historical",
                                    fields: fields,
                                })
                            ),
                            description:
                                "Contains all the queries that operate on historical data that might not be up to date",
                            resolve: () => {
                                return {};
                            },
                        },
                    },
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
