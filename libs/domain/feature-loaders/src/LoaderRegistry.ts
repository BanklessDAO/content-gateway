import { DataLoader } from "@shared/util-loaders";
import { SchemaInfo, schemaInfoToString } from "@banklessdao/util-schema";
import * as O from "fp-ts/lib/Option";
import { LoadersConfig } from ".";
import { createLoaders } from "./loaders";

export type LoaderRegistry = {
    loaders: readonly DataLoader<unknown>[];
    findLoaderBy: <T>(info: SchemaInfo) => O.Option<DataLoader<T>>;
};

export const createLoaderRegistry = (
    apiKeys: LoadersConfig,
    loaders: readonly DataLoader<unknown>[] = createLoaders(apiKeys)
): LoaderRegistry => {
    const lookup = loaders.reduce((map, obj) => {
        const key = schemaInfoToString(obj.info);
        map[key] = obj;
        return map;
    }, {} as Record<string, DataLoader<unknown>>);
    return {
        loaders: loaders,
        findLoaderBy: <T>(info: SchemaInfo): O.Option<DataLoader<T>> => {
            return O.fromNullable(
                lookup[schemaInfoToString(info)] as DataLoader<T>
            );
        },
    };
};
