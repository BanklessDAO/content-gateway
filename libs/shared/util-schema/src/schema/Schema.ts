/* eslint-disable @typescript-eslint/no-explicit-any */
import { createLogger } from "@shared/util-fp";
import { Type } from "@tsed/core";
import { getJsonSchema } from "@tsed/schema";
import Ajv from "ajv/dist/ajv";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { Errors } from "io-ts";
import * as difftool from "json-schema-diff-validator";
import { schemaCodec } from ".";
import { SchemaInfo } from "..";
import { SupportedJSONSchema } from "./codecs";

const ajv = new Ajv({
    allErrors: true,
    $data: true,
    verbose: true,
    validateFormats: true,
    messages: true,
});

const logger = createLogger("Schema");

export type ValidationError = {
    field: string;
    message: string;
};

export type PayloadJson = {
    info: SchemaInfo;
    data: Record<string, unknown>;
};

export type BatchPayloadJson = {
    info: SchemaInfo;
    data: Record<string, unknown>[];
};

/**
 * Represents a {@link Schema} in JSON form.
 */
export type SchemaJson = {
    info: SchemaInfo;
    jsonSchema: Record<string, unknown>;
};

/**
 * A Schema contains metadata about a specific type and functions
 * for validation and serialization. Note that all types will be
 * serialized from/to records, not types. Use type guards to ensure
 * you have the right type.
 */
export type Schema = {
    info: SchemaInfo;
    jsonSchema: SupportedJSONSchema;
    /**
     * Serializes this schema into a JSON string.
     */
    toJson(): SchemaJson;
    /**
     * Validates the given record against the schema.
     */
    validate: (
        data: Record<string, unknown>
    ) => E.Either<ValidationError[], Record<string, unknown>>;

    /**
     * Tells whether this schema has breaking changes compared to
     * the other schema.
     */
    // TODO: make this return errors
    isBackwardCompatibleWith: (other: Schema) => boolean;
};

/**
 * Creates a [[Schema]] object from the given [[type]]
 * and the given schema [[info]].
 * Note that this is a curried function and requireds a [[serializer]]
 * in order to work.
 */
export const createSchemaFromType: <T>(
    info: SchemaInfo,
    type: Type<T>
) => E.Either<Errors, Schema> = (info, type) => {
    return createSchemaFromObject({
        info: info,
        jsonSchema: getJsonSchema(type),
    });
};

/**
 * Creates a [[Schema]] object from the given JSON schema object
 * and the given schema [[info]].
 */
export const createSchemaFromObject = (
    schema: SchemaJson
): E.Either<Errors, Schema> => {
    return pipe(
        E.Do,
        E.bind("validSchema", () => schemaCodec.decode(schema)),
        E.bind("validator", ({ validSchema }) =>
            E.right(ajv.compile(validSchema.jsonSchema))
        ),
        E.map(({ validSchema, validator }) => {
            return {
                info: validSchema.info,
                jsonSchema: validSchema.jsonSchema,
                toJson: () => {
                    return validSchema;
                },
                validate: (data: Record<string, unknown>) => {
                    const validationResult = validator(data);
                    if (validationResult) {
                        return E.right(data);
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
                isBackwardCompatibleWith: (other) => {
                    try {
                        difftool.validateSchemaCompatibility(
                            other.jsonSchema,
                            validSchema.jsonSchema,
                            {
                                allowNewEnumValue: true,
                                allowNewOneOf: true,
                                allowReorder: true,
                            }
                        );
                        return true;
                    } catch (e) {
                        return false;
                    }
                },
            };
        })
    );
};
