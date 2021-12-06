/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "reflect-metadata";
import { SchemaInfo } from "..";

export const types = new Map<string, any>();

export type TypeDescriptor = {
    name: string;
    info: SchemaInfo;
};

const dataMetaKey = Symbol("Data");

export const Data = (info: SchemaInfo) => {
    return Reflect.metadata(dataMetaKey, info);
};

export const getData = (target: Function) => {
    return Reflect.getMetadata(dataMetaKey, target);
};

const propertyMetaKey = Symbol("Property");

export const Property = (required: boolean) => {
    return Reflect.metadata(propertyMetaKey, required);
};

export const getProperty = (target: any, propertyKey: string) => {
    return Reflect.getMetadata(propertyMetaKey, target, propertyKey);
};
