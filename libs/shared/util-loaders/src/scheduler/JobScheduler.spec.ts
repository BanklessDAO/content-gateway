import { createClientStub } from "@banklessdao/content-gateway-client";
import { JobState as PrismaJobState, PrismaClient } from "@cgl/prisma";
import { JobState } from "./JobState";

describe("Given a job scheduler", () => {
    const prisma = new PrismaClient();
    const clientStub = createClientStub();

    it("xul", async () => {
        console.log(JobState.FAILED);
        console.log(PrismaJobState.FAILED);
        console.log(PrismaJobState[JobState.FAILED]);

        expect(true).toBe(true);
    });
});
