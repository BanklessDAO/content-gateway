import { Required } from ".";
import { SchemaInfo } from "../../../../shared/util-schema/src";

export type StringType = {
    _tag: "string";
};

export type NumberType = {
    _tag: "number";
};

export type BooleanType = {
    _tag: "boolean";
};

export type ObjectType = {
    _tag: "object";
    descriptor: TypeDescriptor;
};

export type ArrayType = {
    _tag: "array";
    descriptor: TypeDescriptor;
};

export type PropertyType =
    | StringType
    | NumberType
    | BooleanType
    | ObjectType
    | ArrayType;

export type PropertyDescriptor = {
    name?: string;
    required?: Required;
    type?: PropertyType;
};

export type TypeDescriptor = {
    name?: string;
    properties: Record<string, PropertyDescriptor>;
};

export type SchemaDescriptor = {
    info?: SchemaInfo;
    properties?: Record<string, PropertyDescriptor>;
};