import { PrismaClient } from "@cgl/prisma";
import { createLogger, programError } from "@banklessdao/util-misc";
import { createApp } from "./app";

const logger = createLogger("main");
const prisma = new PrismaClient();

async function main() {
    const port =
        process.env.PORT ||
        process.env.CGL_PORT ||
        programError("You must specify either PORT or CGL_PORT");

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
