import { PrismaClient } from "@cga/prisma";
import { createLogger, programError } from "@shared/util-fp";
import { createApp } from "./app/";

const logger = createLogger("main");
const prisma = new PrismaClient();

async function main() {
    const port =
        process.env.PORT ||
        process.env.CGA_PORT ||
        programError("You must specify either PORT or CGA_PORT");

    const app = await createApp(prisma);

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
