/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    CodecValidationError,
    JSONSchemaType,
    mapCodecValidationError,
    schemaCodec,
    SchemaDefinitions,
    SupportedJSONSchema,
    SupportedPropertyRecord,
} from "@banklessdao/util-data";
import Ajv from "ajv/dist/ajv";
import * as E from "fp-ts/Either";
import { absurd, pipe } from "fp-ts/function";
import * as difftool from "json-schema-diff-validator";
import {
    ClassType,
    extractSchemaDescriptor,
    Required,
    SchemaValidationError,
} from ".";
import { SchemaInfo } from "..";
import { Properties, SchemaDescriptor } from "./decorator/descriptors";

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
    ) => E.Either<SchemaValidationError, Record<string, unknown>>;

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
 * Note that this is a curried function and requires a [[serializer]]
 * in order to work.
 */
export const createSchemaFromClass: <T>(
    type: ClassType<T>
) => E.Either<CodecValidationError, Schema> = (klass) => {
    const definitions: SchemaDefinitions = {};
    const required: string[] = [];
    const properties: SupportedPropertyRecord = {};

    const initializeJsonSchemaType = (name: string): JSONSchemaType => {
        const result: JSONSchemaType = {
            type: "object",
            properties: {},
        };
        definitions[name] = result;
        return result;
    };

    const mapToSchemaRecur = (
        props: Properties,
        type: JSONSchemaType
    ): void => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const required: string[] = [];
        for (const [name, pd] of Object.entries(props.properties)) {
            let minLength: number | undefined = undefined;
            if (pd.required === Required.NON_EMPTY) {
                minLength = 1;
            }
            switch (pd.type._tag) {
                case "number":
                case "boolean":
                case "string":
                    if (minLength) {
                        type.properties[name] = {
                            type: pd.type._tag,
                            minLength,
                        };
                    } else {
                        type.properties[name] = {
                            type: pd.type._tag,
                        };
                    }
                    break;
                case "array":
                    type.properties[name] = {
                        type: "array",
                        items: {
                            type: pd.type.type,
                        },
                    };
                    break;
                case "object-ref":
                    type.properties[name] = {
                        $ref: `#/definitions/${pd.type.descriptor.name}`,
                    };
                    mapToSchemaRecur(
                        pd.type.descriptor,
                        initializeJsonSchemaType(pd.type.descriptor.name)
                    );
                    break;
                case "array-ref":
                    type.properties[name] = {
                        type: "array",
                        items: {
                            $ref: `#/definitions/${pd.type.descriptor.name}`,
                        },
                    };
                    mapToSchemaRecur(
                        pd.type.descriptor,
                        initializeJsonSchemaType(pd.type.descriptor.name)
                    );
                    break;
                default:
                    absurd(pd.type);
            }
            if (pd.required !== Required.OPTIONAL) {
                required?.push(name);
            }
        }
        if (required.length > 0) {
            type.required = required;
        }
    };

    const mapToJsonSchema = (
        descriptor: SchemaDescriptor
    ): SupportedJSONSchema => {
        const result: SupportedJSONSchema = {
            additionalProperties: false,
            type: "object",
            properties: properties,
        };
        mapToSchemaRecur(descriptor, result);
        if (Object.keys(definitions).length > 0) {
            result.definitions = definitions;
        }
        if (required.length > 0) {
            result.required = required;
        }
        return result;
    };

    return pipe(
        E.Do,
        E.bind("descriptor", () => extractSchemaDescriptor(klass)),
        E.bind("jsonSchema", ({ descriptor }) =>
            E.right(mapToJsonSchema(descriptor))
        ),
        E.chainW(({ descriptor, jsonSchema }) => {
            return createSchemaFromObject({
                info: descriptor.info,
                jsonSchema: jsonSchema,
            });
        })
    );
};

/**
 * Creates a [[Schema]] object from the given JSON schema object
 * and the given schema [[info]].
 */
export const createSchemaFromObject = (
    schema: SchemaJson
): E.Either<CodecValidationError, Schema> => {
    if (schema?.jsonSchema?._id) {
        return E.left(new CodecValidationError("_id is a reserved field", []));
    }
    return pipe(
        E.Do,
        E.bind("validSchema", () => schemaCodec.decode(schema)),
        mapCodecValidationError("JSON Schema validation failed."),
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
                            // TODO: took a look...how can we extract the field name?
                            new SchemaValidationError({
                                validationErrors:
                                    validator.errors?.map((err) =>
                                        err.instancePath
                                            ? `Field ${err.instancePath.substring(
                                                  1
                                              )} ${err.message}`
                                            : err.message
                                    ) ?? [],
                            })
                        );
                    }
                },
                isBackwardCompatibleWith: (other: Schema) => {
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
