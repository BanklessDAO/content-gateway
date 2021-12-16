/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as s from "@banklessdao/util-data";
import { programError } from "@banklessdao/util-misc";
import { Schema, SchemaInfo } from "@banklessdao/util-schema";
import * as g from "graphql";
import { pascalCase } from "pascal-case";
import * as pluralize from "pluralize";

export const toSingularName = (info: SchemaInfo, name: string) =>
    pascalCase(info.namespace) + name + info.version;
export const toPluralName = (info: SchemaInfo, name: string) =>
    pascalCase(info.namespace) + pluralize.plural(name) + info.version;

/**
 * Converts the root type in the [[schema]] to a GraphQL object type.
 * This function will also recursively extract any addition object types.
 */
export const toGraphQLType = (schema: Schema): g.GraphQLObjectType => {
    const types = new Map<string, s.JSONSchemaType>();
    const result = new Map<string, g.GraphQLObjectType>();
    const jsonSchema = schema.jsonSchema;
    const typeName = toSingularName(schema.info, schema.info.name);
    types.set(typeName, {
        type: jsonSchema.type,
        properties: jsonSchema.properties,
        required: jsonSchema.required,
    });
    for (const [name, type] of Object.entries(jsonSchema?.definitions ?? {})) {
        types.set(toSingularName(schema.info, name), type);
    }
    types.forEach((_, name) => {
        extractType(schema.info, name, types, result);
    });
    return (
        result.get(typeName) ?? programError(`Could not find type ${typeName}`)
    );
};

const extractType = (
    info: SchemaInfo,
    name: string,
    types: Map<string, s.JSONSchemaType>,
    result: Map<string, g.GraphQLObjectType>
): g.GraphQLObjectType => {
    const source = types.get(name)!;
    if (result.has(name)) {
        return result.get(name)!;
    } else {
        const fields: Record<string, g.GraphQLFieldConfig<any, any>> = {};
        fields["id"] = {
            type: g.GraphQLNonNull(g.GraphQLID),
        };
        Object.entries(source.properties).forEach(([key, value]) => {
            let gfc: g.GraphQLFieldConfig<any, any>;
            if (s.numberPropertyCodec.is(value)) {
                gfc = {
                    type: g.GraphQLFloat,
                };
            } else if (s.stringPropertyCodec.is(value)) {
                gfc = {
                    type: g.GraphQLString,
                };
            } else if (s.booleanPropertyCodec.is(value)) {
                gfc = {
                    type: g.GraphQLBoolean,
                };
            } else if (s.arrayPropertyCodec.is(value)) {
                let agfc: g.GraphQLOutputType;
                if (value.items.type === "string") {
                    agfc = g.GraphQLString;
                } else if (value.items.type === "number") {
                    agfc = g.GraphQLFloat;
                } else if (value.items.type === "boolean") {
                    agfc = g.GraphQLBoolean;
                } else {
                    throw new Error(
                        `Unsupported array type ${value.items.type}`
                    );
                }
                gfc = {
                    type: g.GraphQLList(agfc),
                };
            } else if (s.refPropertyCodec.is(value)) {
                const refName = toSingularName(
                    info,
                    value.$ref.split("/").pop()!
                );
                gfc = {
                    type: extractType(info, refName, types, result),
                };
            } else if (s.arrayRefPropertyCodec.is(value)) {
                const refName = toSingularName(
                    info,
                    value.items.$ref.split("/").pop()!
                );
                gfc = {
                    type: g.GraphQLList(
                        extractType(info, refName, types, result)
                    ),
                };
            } else {
                throw new Error(`Unsupported property type for value ${value}`);
            }
            fields[key] = gfc;
        });

        const type = new g.GraphQLObjectType({
            name: name,
            fields: fields,
        });
        result.set(name, type);
        return type;
    }
};
