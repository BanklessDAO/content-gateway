import { DataLoader } from "@shared/util-loaders";
import { SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import * as O from "fp-ts/lib/Option";
import { loaders as defaultLoaders } from "./loaders";

export type LoaderRegistry = {
    loaders: readonly DataLoader<unknown>[];
    findLoaderBy: <T>(info: SchemaInfo) => O.Option<DataLoader<T>>;
};

export const createLoaderRegistry = (
    loaders: readonly DataLoader<unknown>[] = defaultLoaders
): LoaderRegistry => {
    console.log(loaders);
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
