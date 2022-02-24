import { Schema } from "@banklessdao/util-schema";
import { Entity } from "@shared/util-auth";
import { ContentGatewayUser } from ".";

export type SchemaEntity = Schema & Entity<string, ContentGatewayUser>;
