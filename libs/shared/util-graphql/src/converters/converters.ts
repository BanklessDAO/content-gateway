/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as s from "@shared/util-schema";
import * as g from "graphql";

/**
 * Converts the root type in the [[schema]] to a GraphQL object type.
 * This function will also recursively extract any addition object types.
 */
export const toGraphQLType = (schema: s.Schema): g.GraphQLObjectType => {
    const types = new Map<string, s.JSONSchemaType>();
    const result = new Map<string, g.GraphQLObjectType>();
    const jsonSchema = schema.schemaObject;
    types.set(schema.info.name, {
        type: jsonSchema.type,
        properties: jsonSchema.properties,
        required: jsonSchema.required,
    });
    for (const [name, type] of Object.entries(jsonSchema?.definitions ?? {})) {
        types.set(name, type);
    }
    types.forEach((type, name) => {
        extractType(name, jsonSchema, types, result);
    });
    return result.get(schema.info.name)!;
};

const extractType = (
    name: string,
    schema: s.SupportedJSONSchema,
    types: Map<string, s.JSONSchemaType>,
    result: Map<string, g.GraphQLObjectType>
): g.GraphQLObjectType => {
    const source = types.get(name)!;
    if (result.has(name)) {
        return result.get(name)!;
    } else {
        const fields: Record<string, g.GraphQLFieldConfig<any, any>> = {};
        Object.entries(source.properties).forEach(([key, value]) => {
            let gfc: g.GraphQLFieldConfig<any, any>;
            const valueRecord = value as Record<string, any>;
            if (
                key === "id" &&
                typeof valueRecord === "object" &&
                valueRecord.type === "string" &&
                valueRecord.minLength === 1
            ) {
                gfc = {
                    type: g.GraphQLID,
                };
            } else if (s.numberPropertyCodec.is(value)) {
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
                const refName = value.$ref.split("/").pop()!;
                gfc = {
                    type: extractType(refName, schema, types, result),
                };
            } else if (s.arrayRefPropertyCodec.is(value)) {
                const refName = value.items.$ref.split("/").pop()!;
                gfc = {
                    type: g.GraphQLList(
                        extractType(refName, schema, types, result)
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
