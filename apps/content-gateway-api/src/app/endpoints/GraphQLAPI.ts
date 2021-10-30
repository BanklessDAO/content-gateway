import { DataStorage, SchemaStorage } from "@domain/feature-gateway";
import { toGraphQLType } from "@shared/util-graphql";
import { Schema, schemaInfoToString } from "@shared/util-schema";
import { Request, Response } from "express";
import { graphqlHTTP } from "express-graphql";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { map } from "fp-ts/lib/Identity";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import * as g from "graphql";
import { Logger } from "tslog";
import Pluralize from "typescript-pluralize";
import * as v from "voca";
type SchemaGQLTypePair = [Schema, g.GraphQLObjectType];

const logger = new Logger({ name: "GraphQLAPI" });

export type Middleware = (
    request: Request,
    response: Response
) => Promise<void>;

export type Deps = {
    readonly schemaStorage: SchemaStorageDecorator;
    readonly dataStorage: DataStorage;
};

export type GraphQLAPI = {
    readonly middleware: Middleware;
};

export type SchemaStorageDecorator = SchemaStorage & {
    onRegister: (listener: () => void) => void;
};

/**
 * Creates a new GraphQL API that can be used as an Express middleware.
 */
export const createGraphQLAPI = async (deps: Deps): Promise<Middleware> => {
    let currentMiddleware = await createGraphQLMiddleware(deps);
    deps.schemaStorage.onRegister(() => {
        createGraphQLMiddleware(deps).then(middleware => {
            currentMiddleware = middleware;
        });
    });
    return (request: Request, response: Response): Promise<void> => {
        return currentMiddleware(request, response);
    };
};

const createGraphQLMiddleware = async ({
    schemaStorage,
    dataStorage,
}: Deps): Promise<Middleware> => {
    const schemas = await schemaStorage.findAll()();
    pipe(
        schemas,
        O.map((s) => {
            const str = s
                .map((schema) => schemaInfoToString(schema.info))
                .join();
            logger.info(`Current schemas are: ${str}`);
        })
    );
    return pipe(
        schemas,
        O.getOrElse(() => [] as Schema[]),
        A.map(
            (schema: Schema) =>
                [schema, toGraphQLType(schema)] as SchemaGQLTypePair
        ),
        A.map(([schema, type]) => {
            const name = schema.info.name;
            const findById = async (id: string) => {
                return pipe(
                    dataStorage.findBySchema(schema.info),
                    TO.map((data) =>
                        data.filter((entity) => entity.data.id === id)
                    ),
                    TO.map((data) => data.map((entity) => entity.data)),
                    TO.getOrElse(() => T.of([]))
                )();
            };
            const findAll = async () => {
                return pipe(
                    dataStorage.findBySchema(schema.info),
                    TO.map((data) => data.map((entity) => entity.data)),
                    TO.getOrElse(() => T.of([]))
                )();
            };
            return {
                [v.lowerCase(name)]: {
                    type: type,
                    args: {
                        id: { type: g.GraphQLString },
                    },
                    resolve: (_, { id }) => {
                        return findById(id);
                    },
                },
                [v.lowerCase(Pluralize.plural(name))]: {
                    type: g.GraphQLList(type),
                    resolve: () => {
                        return findAll();
                    },
                },
            };
        }),
        A.reduce(
            {} as g.Thunk<g.GraphQLFieldConfigMap<unknown, unknown>>,
            (acc, curr) => ({
                ...acc,
                ...curr,
            })
        ),
        map((fields) => {
            const queryType = new g.GraphQLObjectType({
                name: "Query",
                fields: fields,
            });
            return new g.GraphQLSchema({ query: queryType });
        }),
        map((schema) => {
            return graphqlHTTP({
                schema: schema,
                graphiql: true,
            });
        })
    );
};

/**
 * Decorates a schema storage with a side effect that will regenerate
 * the GraphQL api whenever a new schema is saved.
 */
export const decorateSchemaStorage = (
    schemaStorage: SchemaStorage
): SchemaStorageDecorator => {
    const gLogger = new Logger({ name: "graphql-updater" });
    const listeners = [] as Array<() => void>;
    return {
        ...schemaStorage,
        register: (schema: Schema) => {
            return pipe(
                schemaStorage.register(schema),
                TE.map((result) => {
                    gLogger.info("Generating new GraphQL API");
                    listeners.forEach((listener) => listener());
                    return result;
                })
            );
        },
        onRegister: (listener: () => void) => {
            listeners.push(listener);
        },
    };
};
