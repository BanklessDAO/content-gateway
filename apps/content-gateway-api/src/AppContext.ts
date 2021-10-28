import { Logger } from "tslog";
import { Application } from "express";
import { PrismaClient } from "@cga/prisma";
import {
    ContentGateway,
    DataStorage,
    SchemaStorage,
} from "@domain/feature-gateway";
import { ContentGatewayClient } from "@banklessdao/content-gateway-client";

export type AppContext = {
    logger: Logger;
    env: string;
    isDev: boolean;
    isProd: boolean;
    app: Application;
    prisma: PrismaClient;
    schemaStorage: SchemaStorage;
    dataStorage: DataStorage;
    gateway: ContentGateway;
    client: ContentGatewayClient;
};
