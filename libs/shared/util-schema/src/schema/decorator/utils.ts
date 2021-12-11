/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import { RefParams, Required } from ".";
import { PropertyType, SchemaDescriptor, TypeDescriptor } from "./descriptors";

const schemaMetaKey = Symbol("Root");
const typeMetaKey = Symbol("Type");

/**
 * Extracts the type name from the given target class.
 */
export const setTypeNameFor = (target: any) => {
    const newMeta = pipe(
        getTypeMeta(target),
        E.map((meta) => {
            meta.name = target.name;
            return meta;
        })
    );
    Reflect.defineMetadata(typeMetaKey, newMeta, target);
};

export const getTypeMeta = (
    target: any,
    property?: string
): E.Either<string[], TypeDescriptor> => {
    const meta = Reflect.getMetadata(typeMetaKey, target) as
        | E.Either<string[], TypeDescriptor>
        | undefined;

    return pipe(
        meta ||
            E.right({
                name: target.name,
                properties: {},
            }),
        E.map((td: TypeDescriptor) => {
            if (property && !td.properties[property]) {
                td.properties[property] = {
                    name: "",
                    type: {
                        _tag: "string",
                    },
                    required: Required.OPTIONAL,
                };
            }
            return td;
        })
    );
};

export const setTypeMeta = (
    meta: E.Either<string[], TypeDescriptor>,
    clazz: any
) => {
    Reflect.defineMetadata(typeMetaKey, meta, clazz);
};

export const getSchemaMeta = (
    target: any
): E.Either<string[], SchemaDescriptor> => {
    const meta = Reflect.getMetadata(schemaMetaKey, target) as
        | E.Either<string[], SchemaDescriptor>
        | undefined;

    return (
        meta ||
        E.right({
            info: {
                namespace: "",
                name: "",
                version: "",
            },
            properties: {},
        })
    );
};

export const setSchemaMeta = (
    meta: E.Either<string[], SchemaDescriptor>,
    clazz: any
) => {
    Reflect.defineMetadata(schemaMetaKey, meta, clazz);
};

export const extractPrimitiveType = (
    type: Function
): PropertyType | undefined => {
    if (type.name === "String") {
        return {
            _tag: "string",
        };
    }
    if (type.name === "Number") {
        return {
            _tag: "number",
        };
    }
    if (type.name === "Boolean") {
        return {
            _tag: "boolean",
        };
    }
    return undefined;
};

export const addTypeError = (
    target: any,
    error = "Property decorator can only be used on class properties"
) => {
    const currentMeta = getTypeMeta(target);
    if (E.isLeft(currentMeta)) {
        return E.left([error, ...currentMeta.left]);
    } else {
        return E.left([error]);
    }
};

/**
 * Creates a decorator that connects the references between class properties.
 */
export const createRefConnector = (
    refType: "array-ref" | "object-ref",
    params: RefParams
) => {
    const { type, required } = params;
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
            // TODO! check the decorator against the design type
            newMeta = pipe(
                E.Do,
                E.bind("currentMeta", () => getTypeMeta(clazz, propertyName)),
                E.bind("refMeta", () => getTypeMeta(type)),
                E.map(({ currentMeta, refMeta }) => {
                    //* we know that refMeta will be complete at this point
                    //* 👇 because of the implicit decorator evaluation order
                    const pd = currentMeta.properties[propertyName];
                    pd.name = propertyName;
                    pd.type = {
                        _tag: refType,
                        descriptor: refMeta,
                    };
                    pd.required = required;
                    return currentMeta;
                })
            );
        }
        Reflect.defineMetadata(typeMetaKey, newMeta, clazz);
    };
};
