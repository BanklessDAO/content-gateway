import { SchemaInfo } from "@banklessdao/util-schema";
import { Operation } from "@shared/util-auth";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import {
    ContentGatewayUser, SchemaEntity,
    SchemaRepository
} from "..";

export const FIND_SCHEMA_FOR = "FIND_SCHEMA_FOR";

export type FindSchemaForParams<T> = T & { info: SchemaInfo };

export type FindSchemaForResult<T> = Omit<FindSchemaForParams<T>, "info"> & {
    schema: SchemaEntity;
    owner: ContentGatewayUser;
};

export type FindSchemaFor<T> = Operation<
    FindSchemaForParams<T>,
    FindSchemaForResult<T>
>;

/**
 * Tries to find the schema for the given object that has schema info in it.
 * Returns a new object that replaces the info with the actual schema.
 */
export const makeFindSchemaFor = <T>(
    schemaRepository: SchemaRepository
): FindSchemaFor<T> => ({
    name: FIND_SCHEMA_FOR,
    execute: (params: FindSchemaForParams<T>) => {
        const { info, ...rest } = params;
        return pipe(
            schemaRepository.find(info),
            TE.map((schema) => ({
                ...rest,
                schema,
                owner: schema.owner,
            }))
        );
    },
});
