/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-types */
import * as E from "fp-ts/lib/Either";
import { pipe } from "fp-ts/lib/function";
import { ClassType, Required } from ".";
import { TypeDescriptor } from "./descriptors";
import { addTypeError, createRefConnector, getTypeMeta, setTypeMeta } from "./utils";

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
