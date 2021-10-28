import { toGraphQLType } from "@shared/util-graphql";
import { Schema } from "@shared/util-schema";
import { graphqlHTTP } from "express-graphql";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/lib/function";
import { map } from "fp-ts/lib/Identity";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TO from "fp-ts/TaskOption";
import * as g from "graphql";
import Pluralize from "typescript-pluralize";
import * as v from "voca";
import { AppContext } from "../..";
type SchemaGQLTypePair = [Schema, g.GraphQLObjectType];

export const generateGraphQLAPI = async ({
    schemaStorage,
    dataStorage,
    isDev,
}: AppContext) => {
    return pipe(
        await schemaStorage.findAll()(),
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
                graphiql: isDev,
            });
        })
    );
};
