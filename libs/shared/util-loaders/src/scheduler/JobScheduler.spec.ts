import { createClientStub } from "@banklessdao/content-gateway-client";
import { PrismaClient } from "@cgl/prisma";
import { createJobScheduler } from ".";

describe("Given a job scheduler", () => {
    const prisma = new PrismaClient();
    const clientStub = createClientStub();

    const scheduler = createJobScheduler(prisma, clientStub);

    it("xul", async () => {
        expect(true).toBe(true);
    });
});
