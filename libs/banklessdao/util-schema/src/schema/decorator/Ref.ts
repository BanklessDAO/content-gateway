/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { ClassType, Required } from ".";
import { TypeDescriptor } from "./descriptors";
import {
    addTypeError,
    createRefConnector,
    getTypeMeta,
    setTypeMeta
} from "./utils";

export type RefParams = {
    type: ClassType;
    required: Required;
};

export type ArrayRefParams = RefParams;

export type ArrayParams = {
    type: "string" | "number" | "boolean";
    required: Required;
};

/**
 * Marks a property as a primitive array.
 */
// TODO: this is duplicate code, but we'll figure it out later.
export const ArrayOf = (params: ArrayParams) => {
    const { required, type } = params;
    return (target: any, propertyName: string) => {
        let clazz = target;
        let newMeta: E.Either<string[], TypeDescriptor>;
        if (typeof target === "function") {
            newMeta = addTypeError(target);
        } else {
            clazz = target.constructor;
            newMeta = pipe(
                E.Do,
                E.bind("currentMeta", () => getTypeMeta(clazz, propertyName)),
                E.map(({ currentMeta }) => {
                    const pd = currentMeta.properties[propertyName];
                    pd.name = propertyName;
                    pd.required = required;
                    pd.type = {
                        _tag: "array",
                        type: type,
                    };
                    return currentMeta;
                })
            );
        }
        setTypeMeta(newMeta, clazz);
    };
};

/**
 * Connects a class {@link Property} in your schema to another
 * {@link Type}. Use this for **array** references.
 */
export const ArrayRef = (params: ArrayRefParams) => {
    return createRefConnector("array-ref", params);
};

/**
 * Connects a class {@link Property} in your schema to another
 * {@link Type}. Use this for plain **object** references.
 */
export const ObjectRef = (params: RefParams) => {
    return createRefConnector("object-ref", params);
};

/**
 * Shorthand for:
 * ```ts
 * @ArrayOf({
        required: Required.REQUIRED,
        type: "string",
    })
 * ```
 */
export const RequiredStringArrayOf = () => {
    return ArrayOf({
        required: Required.REQUIRED,
        type: "string",
    });
};

/**
 * Shorthand for:
 * ```ts
 * @ArrayOf({
        required: Required.REQUIRED,
        type: "number",
    })
 * ```
 */
export const RequiredNumberArrayOf = () => {
    return ArrayOf({
        required: Required.REQUIRED,
        type: "number",
    });
};

/**
 * Shorthand for:
 * ```ts
 * @ArrayOf({
        required: Required.REQUIRED,
        type: "boolean",
    })
 * ```
 */
export const RequiredBooleanArrayOf = () => {
    return ArrayOf({
        required: Required.REQUIRED,
        type: "boolean",
    });
};

/**
 * Shorthand for:
 * ```ts
 * @ArrayOf({
        required: Required.OPTIONAL,
        type: "string",
    })
 * ```
 */
export const OptionalStringArrayOf = () => {
    return ArrayOf({
        required: Required.OPTIONAL,
        type: "string",
    });
};

/**
     * Shorthand for:
     * ```ts
     * @ArrayOf({
            required: Required.OPTIONAL,
            type: "number",
        })
     * ```
     */
export const OptionalNumberArrayOf = () => {
    return ArrayOf({
        required: Required.OPTIONAL,
        type: "number",
    });
};

/**
     * Shorthand for:
     * ```ts
     * @ArrayOf({
            required: Required.OPTIONAL,
            type: "boolean",
        })
     * ```
     */
export const OptionalBooleanArrayOf = () => {
    return ArrayOf({
        required: Required.OPTIONAL,
        type: "boolean",
    });
};

/**
 * Shorthand for:
 * ```ts
 * @ObjectRef({
 *     type: type,
 *     required: Required.REQUIRED,
 * })
 * ```
 */
export const RequiredObjectRef = (type: ClassType) => {
    return createRefConnector("object-ref", {
        required: Required.REQUIRED,
        type: type,
    });
};

/**
 * Shorthand for:
 * ```ts
 * @ObjectRef({
 *     type: type,
 *     required: Required.REQUIRED,
 * })
 * ```
 */
export const OptionalObjectRef = (type: ClassType) => {
    return createRefConnector("object-ref", {
        required: Required.OPTIONAL,
        type: type,
    });
};

/**
 * Shorthand for:
 * ```ts
 * @ArrayRef({
 *     type: type,
 *     required: Required.REQUIRED,
 * })
 * ```
 */
export const RequiredArrayRef = (type: ClassType) => {
    return createRefConnector("array-ref", {
        required: Required.REQUIRED,
        type: type,
    });
};

/**
 * Shorthand for:
 * ```ts
 * @ArrayRef({
 *     type: type,
 *     required: Required.REQUIRED,
 * })
 * ```
 */
export const OptionalArrayRef = (type: ClassType) => {
    return createRefConnector("array-ref", {
        required: Required.OPTIONAL,
        type: type,
    });
};
