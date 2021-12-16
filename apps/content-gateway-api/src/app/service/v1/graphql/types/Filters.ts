import { FilterType } from "@domain/feature-gateway";
import * as s from "@banklessdao/util-data";
import * as g from "graphql";

const IDFilter = new g.GraphQLInputObjectType({
    name: "IDFilter",
    fields: {
        [FilterType.equals]: { type: g.GraphQLString },
        [FilterType.not]: { type: g.GraphQLString },
    },
});

const StringFilter = new g.GraphQLInputObjectType({
    name: "StringFilter",
    fields: {
        [FilterType.equals]: { type: g.GraphQLString },
        [FilterType.not]: { type: g.GraphQLString },
        [FilterType.contains]: { type: g.GraphQLString },
        [FilterType.starts_with]: { type: g.GraphQLString },
        [FilterType.ends_with]: { type: g.GraphQLString },
    },
});

const BooleanFilter = new g.GraphQLInputObjectType({
    name: "BooleanFilter",
    fields: {
        [FilterType.equals]: { type: g.GraphQLBoolean },
        [FilterType.not]: { type: g.GraphQLBoolean },
    },
});

const FloatFilter = new g.GraphQLInputObjectType({
    name: "NumberFilter",
    fields: {
        [FilterType.equals]: { type: g.GraphQLFloat },
        [FilterType.not]: { type: g.GraphQLFloat },
        [FilterType.lt]: { type: g.GraphQLFloat },
        [FilterType.lte]: { type: g.GraphQLFloat },
        [FilterType.gt]: { type: g.GraphQLFloat },
        [FilterType.gte]: { type: g.GraphQLFloat },
    },
});

export type AnyFilter = {
    [key in FilterType]?: unknown;
};

export const createFiltersFor = (name: string, type: s.JSONSchemaType) => {
    const fields: g.GraphQLInputFieldConfigMap = {};
    Object.entries(type.properties).forEach(([fieldName, props]) => {
        if (fieldName === "id" && s.idPropertyCodec.is(props)) {
            fields[fieldName] = { type: IDFilter };
        } else if (s.numberPropertyCodec.is(props)) {
            fields[fieldName] = { type: FloatFilter };
        } else if (s.stringPropertyCodec.is(props)) {
            fields[fieldName] = { type: StringFilter };
        } else if (s.booleanPropertyCodec.is(props)) {
            fields[fieldName] = { type: BooleanFilter };
        }
    });
    return new g.GraphQLInputObjectType({
        name: `${name}Filters`,
        fields: fields,
    });
};
