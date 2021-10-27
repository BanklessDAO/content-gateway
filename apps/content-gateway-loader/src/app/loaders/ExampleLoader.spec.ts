import { exampleLoader } from "./ExampleLoader";
import {
    createStubClient,
    StubClientObjects,
} from "@banklessdao/content-gateway-client";
import { createJobSchedulerStub, JobSchedulerStub } from "..";
import { isRight } from "fp-ts/lib/Either";

describe("Given an example loader", () => {
    const loader = exampleLoader;

    let clientStub: StubClientObjects;
    let jobSchedulerStub: JobSchedulerStub;

    beforeEach(() => {
        clientStub = createStubClient();
        jobSchedulerStub = createJobSchedulerStub();
    });

    it("When initialize is called Then it runs successfully", async () => {
        const result = await loader.initialize({
            client: clientStub.client,
            jobScheduler: jobSchedulerStub,
        })();

        expect(isRight(result)).toBeTruthy();
    });

    it("When initialize is called Then it schedules a job", async () => {
        await loader.initialize({
            client: clientStub.client,
            jobScheduler: jobSchedulerStub,
        })();

        expect(jobSchedulerStub.scheduledJobs[0].name).toEqual(loader.name);
    });
});
