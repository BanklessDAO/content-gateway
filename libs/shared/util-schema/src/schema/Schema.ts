/* eslint-disable @typescript-eslint/no-explicit-any */
import { Type } from "@tsed/core";
import { getJsonSchema } from "@tsed/schema";
import Ajv from "ajv/dist/ajv";
import * as E from "fp-ts/Either";
import { Errors } from "io-ts";
import { JSONSerializer } from ".";
import { SchemaInfo } from "..";
import { SupportedJSONSchema, supportedJSONSchemaCodec } from "./codecs";

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

/**
 * A Schema contains metadata about a specific type and functions
 * for validation and serialization. Note that all types will be
 * serialized from/to records, not types. Use type guards to ensure
 * you have the right type.
 */
export type Schema = {
    info: SchemaInfo;
    schemaObject: SupportedJSONSchema;
    /**
     * Serializes this schema into a JSON string.
     */
    toJSONString(): string;
    /**
     * Validates the given record against the schema.
     */
    validate: (
        data: Record<string, unknown>
    ) => E.Either<ValidationError[], void>;
    /**
     * Serializes the given record into a JSON string.
     */
    serialize: (data: Record<string, unknown>) => E.Either<Error, string>;
    /**
     * Deserializes the given JSON string into a record.
     */
    deserialize: (data: string) => E.Either<Error, Record<string, unknown>>;
};

/**
 * Creates a [[Schema]] object from the given JSON Schema (string)
 * and the given schema info.
 */
export const createSchemaFromString: (
    key: SchemaInfo,
    schema: string,
    jsonSerializer: JSONSerializer
) => E.Either<Errors, Schema> = (key, schema, jsonSerializer) => {
    return createSchemaFromObject(key, JSON.parse(schema), jsonSerializer);
};

/**
 * Creates a [[Schema]] object from the given [[type]]
 * and the given schema [[info]].
 */
export const createSchemaFromType: <T>(
    info: SchemaInfo,
    type: Type<T>,
    jsonSerializer: JSONSerializer
) => E.Either<Errors, Schema> = (info, type, jsonSerializer) => {
    return createSchemaFromObject(info, getJsonSchema(type), jsonSerializer);
};

/**
 * Creates a [[Schema]] object from the given JSON schema object
 * and the given schema [[info]].
 */
export const createSchemaFromObject: (
    info: SchemaInfo,
    schema: Record<string, unknown>,
    jsonSerializer: JSONSerializer
) => E.Either<Errors, Schema> = (info, schema, jsonSerializer) => {
    const schemaValidationResult = supportedJSONSchemaCodec.decode(schema);
    if (E.isLeft(schemaValidationResult)) {
        return schemaValidationResult;
    }
    const validator = ajv.compile(schema);
    const result = {
        info: info,
        // safe cast, we know it is valid, because we checked at the start
        schemaObject: schema as SupportedJSONSchema,
        toJSONString: () => jsonSerializer.serialize(schema),
        validate: (data: Record<string, unknown>) => {
            const validationResult = validator(data);
            if (validationResult) {
                return E.right(undefined);
            } else {
                return E.left(
                    // ❗ Take a look at what is actually produced by ajv here
                    validator.errors?.map((e) => ({
                        field: e.instancePath ?? "unknown field",
                        message: e.message ?? "The value is invalid",
                    })) ?? []
                );
            }
        },
        serialize: (data: Record<string, unknown>) => {
            return E.tryCatch(
                () => jsonSerializer.serialize(data),
                (e) => new Error(String(e))
            );
        },
        deserialize: (data: string) => {
            return E.tryCatch(
                () => jsonSerializer.deserialize(data),
                (e) => new Error(String(e))
            );
        },
    };
    return E.right(result);
};
