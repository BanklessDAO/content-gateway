/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { TypeDescriptor } from "./descriptors";
import {
    addTypeError,
    extractPrimitiveType,
    getTypeMeta,
    setTypeMeta
} from "./utils";

export const Required = {
    REQUIRED: "REQUIRED",
    OPTIONAL: "OPTIONAL",
    NON_EMPTY: "NON_EMPTY"
} as const;

export type Required = keyof typeof Required;

export type PropertyParams = {
    required: Required;
};

/**
 * Use the {@link Property} decorator on all your class properties
 * that you want to add to the final schema.
 */
export const Property = (params: PropertyParams) => {
    const { required } = params;
    return (target: any, propertyName: string) => {
        let clazz = target;
        let newMeta: E.Either<string[], TypeDescriptor>;
        if (typeof target === "function") {
            newMeta = addTypeError(target);
        } else {
            clazz = target.constructor;
            const designType: Function = Reflect.getMetadata(
                "design:type",
                target,
                propertyName
            );
            newMeta = pipe(
                E.Do,
                E.bind("currentMeta", () => getTypeMeta(clazz, propertyName)),
                E.map(({ currentMeta }) => {
                    const pd = currentMeta.properties[propertyName];
                    pd.name = propertyName;
                    pd.required = required;
                    const pt = extractPrimitiveType(designType);
                    if (pt) {
                        pd.type = pt;
                    }
                    return currentMeta;
                })
            );
        }
        setTypeMeta(newMeta, clazz);
    };
};
