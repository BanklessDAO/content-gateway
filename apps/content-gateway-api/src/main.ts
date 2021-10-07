import { createContentGateway, createInMemoryDataStorage, createInMemorySchemaStorage } from "@domain/feature-gateway";
import * as express from "express";

const app = express();

const schemaStorage = createInMemorySchemaStorage();
const dataStorage = createInMemoryDataStorage();
const gateway = createContentGateway(schemaStorage, dataStorage);

app.get("/api", (req, res) => {
    res.send({ message: "Welcome to content-gateway-api!" });
});

const port = process.env.port || 3333;
const server = app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}/api`);
});
server.on("error", console.error);
