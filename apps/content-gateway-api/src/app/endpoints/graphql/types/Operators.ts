import { OperatorType } from "@shared/util-loaders";
import * as g from "graphql";

const operatorTypeValues: Record<string, unknown> = {};

Object.keys(OperatorType)
    .filter((it) => it.length > 1)
    .forEach((key) => {
        operatorTypeValues[key] = { value: OperatorType[key] };
    });

const operatorType = new g.GraphQLEnumType({
    name: "OperatorType",
    values: operatorTypeValues,
});

const operator = new g.GraphQLInputObjectType({
    name: "Operator",
    fields: () => ({
        field: { type: new g.GraphQLNonNull(g.GraphQLString) },
        value: { type: new g.GraphQLNonNull(g.GraphQLString) },
        type: {
            type: operatorType,
        },
    }),
});

export const operators = {
    type: new g.GraphQLList(operator),
};
