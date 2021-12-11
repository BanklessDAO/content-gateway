/* eslint-disable @typescript-eslint/ban-types */
import { CodecValidationError } from "@shared/util-data";
import { DeepRequired } from "@shared/util-fp";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import "reflect-metadata";
import { ClassType } from ".";
import { SchemaInfo } from "../..";
import { SchemaDescriptor } from "./descriptors";
import {
    getSchemaMeta,
    getTypeMeta,
    setSchemaMeta,
    setTypeNameFor
} from "./utils";

export type DataParams = {
    /**
     * The {@link SchemaInfo} is an unique identifier for your {@link Data}.
     * (namespace, name, version). This has to be unique across the board.
     */
    info: SchemaInfo;
};

/**
 * Use this decorator to mark the class that you want to register
 * with Content Gateway.
 */
export const Data = (params: DataParams) => {
    const { info } = params;
    return (target: Function) => {
        const newMeta = pipe(
            getSchemaMeta(target),
            E.map((meta) => {
                meta.info = info;
                return meta;
            })
        );
        setSchemaMeta(newMeta, target);
        setTypeNameFor(target);
    };
};

/**
 * Extracts the schema metadata information from the given class.
 */
export const extractSchemaDescriptor = (
    target: ClassType
): E.Either<CodecValidationError, DeepRequired<SchemaDescriptor>> => {
    return pipe(
        E.Do,
        E.bind("typeMeta", () => getTypeMeta(target)),
        E.bind("schemaMeta", () => getSchemaMeta(target)),
        E.map(({ typeMeta, schemaMeta }) => {
            return {
                properties: typeMeta.properties,
                info: schemaMeta.info,
            } as DeepRequired<SchemaDescriptor>;
        }),
        E.mapLeft((errors) => {
            return new CodecValidationError(
                `Failed to extract schema descriptor from ${target.name}`,
                errors.map((e) => ({
                    value: "",
                    context: [],
                    message: e,
                }))
            );
        })
    );
};
