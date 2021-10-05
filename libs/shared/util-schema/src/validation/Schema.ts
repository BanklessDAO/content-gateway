/* eslint-disable @typescript-eslint/no-explicit-any */
import { TypeKey } from "..";
import { Type } from "@tsed/core";
import { getJsonSchema } from "@tsed/schema";
import Ajv from "ajv/dist/ajv";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import { GraphQLNamedType } from "graphql/type";

type NumberProperty = {
    type: "number";
};

export const isNumberProperty = (
    data: Record<string, any>
): data is NumberProperty => data.type === "number";

type StringProperty = {
    type: "string";
    minLength?: number;
};

export const isStringProperty = (
    data: Record<string, any>
): data is StringProperty =>
    data.type === "string" && typeof (data?.minLength ?? 1) === "number";

type ArrayProperty = {
    type: "array";
    items: {
        type: string;
    };
};

export const isArrayProperty = (
    data: Record<string, any>
): data is ArrayProperty => {
    return (
        data.type === "array" && typeof (data?.items?.type ?? 1) === "string"
    );
};

type RefProperty = {
    $ref: string;
};

export const isRefProperty = (
    data: Record<string, any>
): data is RefProperty => {
    return typeof (data?.$ref ?? 1) === "string";
};

type ArrayRefProperty = {
    type: "array";
    items: {
        $ref: string;
    };
};

export const isArrayRefProperty = (
    data: Record<string, any>
): data is ArrayRefProperty => {
    return (
        data.type === "array" && typeof (data?.items?.$ref ?? 1) === "string"
    );
};

type SupportedProperties =
    | NumberProperty
    | StringProperty
    | ArrayProperty
    | RefProperty
    | ArrayRefProperty;

export const isSupportedProperty = (
    data: Record<string, any>
): data is SupportedProperties => {
    return (
        isNumberProperty(data) ||
        isStringProperty(data) ||
        isArrayProperty(data) ||
        isRefProperty(data) ||
        isArrayRefProperty(data)
    );
};

type JSONSchemaProps = {
    type: "object";
    properties: Record<string, SupportedProperties>;
    required?: string[];
};

export const isRecord = (
    data: Record<string, any>,
    matcher: (data: Record<string, any>) => boolean
): data is Record<string, SupportedProperties> => {
    return (
        typeof data === "object" &&
        Object.keys(data)
            .map((key) => data[key])
            .map(matcher)
            .reduce((acc, next) => acc && next)
    );
};

export const isPropertiesRecord = (
    data: Record<string, any>
): data is Record<string, SupportedProperties> => {
    return isRecord(data, isSupportedProperty);
};

export const isArrayOfType = <T>(data: any, type: string): data is T[] => {
    return (
        Array.isArray(data) && (data.length === 0 || typeof data[0] === type)
    );
};

export const isJSONSchemaProps = (
    data: Record<string, any>
): data is JSONSchemaProps => {
    return (
        data.type === "object" &&
        isPropertiesRecord(data.properties) &&
        (typeof data.required === "undefined" ||
            isArrayOfType(data.required, "string"))
    );
};

/**
 * This type represents the subset of JSON Schema that is supported.
 */
type SupportedJSONSchema = JSONSchemaProps & {
    definitions?: Record<string, SupportedJSONSchema>;
};

export const isSupportedJSONSchema = (
    data: Record<string, any>
): data is SupportedJSONSchema => {
    const hasOptionalDefinitions =
        typeof data.definitions === "undefined" ||
        isRecord(data.definitions, isSupportedJSONSchema);
    const isValidJSONSchemaProps = isJSONSchemaProps(data);
    return hasOptionalDefinitions && isValidJSONSchemaProps;
};

/**
 * A Schema contains metadata about a specific type and functions
 * for validation and serialization.
 */
export type Schema<T> = {
    key: TypeKey<T>;
    schemaObject: SupportedJSONSchema;
    validate: (
        data: Record<string, unknown> | T
    ) => E.Either<ValidationError[], void>;
    serialize: (data: Record<string, unknown> | T) => E.Either<Error, string>;
    deserialize: (data: string) => E.Either<Error, Record<string, unknown>>;
};

const ajv = new Ajv({
    allErrors: true,
    $data: true,
    verbose: true,
    validateFormats: true,
    messages: true,
});

export type ValidationError = {
    field: string;
    message: string;
};

export const createSchemaFromString: (
    key: TypeKey<any>,
    schema: string
) => E.Either<Error, Schema<any>> = (key, schema) => {
    return createSchemaFromObject(key, JSON.parse(schema));
};

export const createSchemaFromType: <T>(
    key: TypeKey<any>,
    type: Type<T>
) => E.Either<Error, Schema<any>> = (key, type) => {
    return createSchemaFromObject(key, getJsonSchema(type));
};

export const createSchemaFromObject: (
    key: TypeKey<any>,
    schema: Record<string, unknown>
) => E.Either<Error, Schema<any>> = (key, schema) => {
    const good = isSupportedJSONSchema(schema);
    if (!good) {
        return E.left(
            new Error("Invalid schema, please check the supported options.")
        );
    }
    const validator = ajv.compile(schema);
    // ❗ Use secure serialization here
    const serialize = JSON.stringify;
    const parse = JSON.parse;
    const result = {
        key: key,
        schemaObject: schema as SupportedJSONSchema,
        validate: (data: any) => {
            const validationResult = validator(data);
            if (validationResult) {
                return E.right(undefined);
            } else {
                return E.left(
                    validator.errors?.map((e) => ({
                        field: e.instancePath ?? "unknown field",
                        message: e.message ?? "The value is invalid",
                    })) ?? []
                );
            }
        },
        serialize: (data: Record<string, unknown> | any) => {
            return E.right(serialize(data));
        },
        deserialize: (data: string) => {
            return E.right(parse(data));
        },
    };
    return E.right(result);
};

export const toGraphqlType: <T>(
    schema: Schema<T>
) => O.Option<GraphQLNamedType> = (schema) => {
    const { namespace, name, version } = schema.key;
    return O.none;
};
