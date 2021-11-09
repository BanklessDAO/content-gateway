import { PrismaClient } from "@cga/prisma";
import { Logger } from "tslog";
import { createAPI } from "./app/";

const logger = new Logger({ name: "main" });

const prisma = new PrismaClient();

async function main() {
    const port =
        process.env.PORT ||
        process.env.CGA_PORT ||
        programError("You must specify either PORT or CGA_PORT");

    const app = await createAPI(prisma);

    const server = app.listen(port, () => {
        console.log(`Listening at http://localhost:${port}`);
    });

    server.on("error", (err) => {
        logger.error(err);
    });
}

main()
    .catch((err) => logger.error(err))
    .finally(() => {
        prisma.$disconnect();
    });

const programError = (message: string) => {
    throw new Error(message);
};
