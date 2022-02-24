import { Operation } from "@shared/util-auth";
import { SchemaEntity, SchemaRepository } from "..";

export const REMOVE_SCHEMA = "REMOVE_SCHEMA";

export type RemoveSchemaParams = {
    schema: SchemaEntity;
};

export type RemoveSchema = Operation<RemoveSchemaParams, void>;

/**
 * Removes a schema and **deletes all data** associated with it.
 */
export const makeRemoveSchema = (
    schemaRepository: SchemaRepository
): RemoveSchema => ({
    name: REMOVE_SCHEMA,
    execute: ({ schema }: RemoveSchemaParams) =>
        schemaRepository.remove(schema),
});
