import { ContentGatewayClient } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cga/prisma";
import { ContentGateway, DataRepository } from "@domain/feature-gateway";
import { LoaderRegistry } from "@domain/feature-loaders";
import { Application } from "express";
import { Logger } from "tslog";
import { SchemaRepositoryDecorator } from "./endpoints";

export type AppContext = {
    logger: Logger;
    env: string;
    isDev: boolean;
    isProd: boolean;
    app: Application;
    prisma: PrismaClient;
    schemaRepository: SchemaRepositoryDecorator;
    dataRepository: DataRepository;
    loaderRegistry: LoaderRegistry;
    gateway: ContentGateway;
    client: ContentGatewayClient;
};
