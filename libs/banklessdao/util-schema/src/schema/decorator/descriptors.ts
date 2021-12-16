import { Required } from ".";
import { SchemaInfo } from "../..";

export type StringType = {
    _tag: "string";
};

export type NumberType = {
    _tag: "number";
};

export type BooleanType = {
    _tag: "boolean";
};

export type ArrayType = {
    _tag: "array";
    type: "string" | "number" | "boolean";
};

export type ObjectRefType = {
    _tag: "object-ref";
    descriptor: TypeDescriptor;
};

export type ArrayRefType = {
    _tag: "array-ref";
    descriptor: TypeDescriptor;
};

export type PropertyType =
    | StringType
    | NumberType
    | BooleanType
    | ArrayType
    | ObjectRefType
    | ArrayRefType;

export type PropertyDescriptor = {
    name: string;
    required: Required;
    type: PropertyType;
};

export type Properties = {
    properties: Record<string, PropertyDescriptor>;
};

export type TypeDescriptor = {
    name: string;
} & Properties;

export type SchemaDescriptor = {
    info: SchemaInfo;
} & Properties;
