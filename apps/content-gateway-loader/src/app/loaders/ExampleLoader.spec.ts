import {
    ContentGatewayClientStub,
    createClientStub,
} from "@banklessdao/content-gateway-client";
import { isRight } from "fp-ts/lib/Either";
import { createJobSchedulerStub, JobSchedulerStub } from "..";
import { exampleLoader } from "./ExampleLoader";

describe("Given an example loader", () => {
    const loader = exampleLoader;

    let clientStub: ContentGatewayClientStub;
    let jobSchedulerStub: JobSchedulerStub;

    beforeEach(() => {
        clientStub = createClientStub();
        jobSchedulerStub = createJobSchedulerStub();
    });

    it("When initialize is called Then it runs successfully", async () => {
        const result = await loader.initialize({
            client: clientStub,
            jobScheduler: jobSchedulerStub,
        })();

        expect(isRight(result)).toBeTruthy();
    });

    it("When initialize is called Then it schedules a job", async () => {
        await loader.initialize({
            client: clientStub,
            jobScheduler: jobSchedulerStub,
        })();

        expect(jobSchedulerStub.scheduledJobs[0].name).toEqual(loader.name);
    });
});
