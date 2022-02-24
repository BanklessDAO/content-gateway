import { Schema } from "@banklessdao/util-schema";
import { Operation } from "@shared/util-auth";
import { ContentGatewayUser, SchemaRepository } from "..";

export const REGISTER_SCHEMA = "REGISTER_SCHEMA";

export type RegisterSchemaParams = {
    schema: Schema;
    owner: ContentGatewayUser;
};

export type RegisterSchema = Operation<RegisterSchemaParams, void>;

/**
 * Registers a new schema with the Content Gateway.
 */
export const makeRegisterSchema = (
    schemaRepository: SchemaRepository
): RegisterSchema => ({
    name: REGISTER_SCHEMA,
    execute: ({ schema, owner }: RegisterSchemaParams) =>
        schemaRepository.register(schema, owner)
    
});
