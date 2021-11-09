import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cga/prisma";
import { ContentGateway, DataStorage } from "@domain/feature-gateway";
import { Application } from "express";
import { Logger } from "tslog";
import { SchemaStorageDecorator } from "./endpoints";

export type AppContext = {
    logger: Logger;
    env: string;
    isDev: boolean;
    isProd: boolean;
    app: Application;
    prisma: PrismaClient;
    schemaStorage: SchemaStorageDecorator;
    dataStorage: DataStorage;
    gateway: ContentGateway;
    client: ContentGatewayClient;
};
