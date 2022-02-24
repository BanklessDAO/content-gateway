import { Operation } from "@shared/util-auth";
import * as TE from "fp-ts/TaskEither";
import { SchemaRepository, SchemaStat } from "..";

export const LOAD_SCHEMA_STATS = "LOAD_SCHEMA_STATS";

export type LoadSchemaStats = Operation<void, Array<SchemaStat>>;

/**
 * Creates a function that can be used to load [[SchemaStat]]s.
 */
export const makeLoadSchemaStats = (
    schemaRepository: SchemaRepository
): LoadSchemaStats => ({
    name: LOAD_SCHEMA_STATS,
    execute: () => TE.fromTask(schemaRepository.loadStats()),
});
