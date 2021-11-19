import { FilterType } from "@domain/feature-gateway";
import * as s from "@shared/util-schema";
import * as g from "graphql";

const filterTypeLookup: Record<string, FilterType[]> = {
    [g.GraphQLID.name]: [FilterType.equals, FilterType.not],
    [g.GraphQLString.name]: [
        FilterType.equals,
        FilterType.not,
        FilterType.contains,
        FilterType.starts_with,
        FilterType.ends_with,
    ],
    [g.GraphQLBoolean.name]: [FilterType.equals, FilterType.not],
    [g.GraphQLFloat.name]: [
        FilterType.equals,
        FilterType.not,
        FilterType.lt,
        FilterType.lte,
        FilterType.gt,
        FilterType.gte,
    ],
};

const addFilterTypes = (
    type: g.GraphQLScalarType,
    fieldName: string,
    fields: g.GraphQLInputFieldConfigMap
) => {
    filterTypeLookup[type.name].forEach((filterType) => {
        fields[`${fieldName}_${filterType}`] = {
            type: type,
        };
    });
};

export const createFiltersFor = (name: string, type: s.JSONSchemaType) => {
    const fields: g.GraphQLInputFieldConfigMap = {};
    Object.entries(type.properties).forEach(([fieldName, props]) => {
        if (fieldName === "id" && s.idPropertyCodec.is(props)) {
            addFilterTypes(g.GraphQLID, fieldName, fields);
        } else if (s.numberPropertyCodec.is(props)) {
            addFilterTypes(g.GraphQLFloat, fieldName, fields);
        } else if (s.stringPropertyCodec.is(props)) {
            console.log(fieldName, props);
            addFilterTypes(g.GraphQLString, fieldName, fields);
        } else if (s.booleanPropertyCodec.is(props)) {
            addFilterTypes(g.GraphQLBoolean, fieldName, fields);
        }
    });
    return new g.GraphQLInputObjectType({
        name: `${name}Filters`,
        fields: fields,
    });
};
