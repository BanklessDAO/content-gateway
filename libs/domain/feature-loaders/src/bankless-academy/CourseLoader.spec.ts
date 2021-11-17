import {
    ContentGatewayClientStub,
    createClientStub
} from "@banklessdao/content-gateway-client";
import { createJobSchedulerStub, JobSchedulerStub } from "@shared/util-loaders";
import axios from "axios";
import { isRight } from "fp-ts/lib/Either";
import { courseLoader } from "./CourseLoader";
axios.defaults.adapter = require("axios/lib/adapters/http");

type Slide = {
    type: string;
    title: string;
    content?: string;
    quiz?: Record<string, unknown>;
    component?: string;
};

interface ServerResponse {
    data: ResponseItem;
}

type ResponseItem = {
    poapImageLink: string;
    learningActions: string;
    knowledgeRequirements: string;
    poapEventId: number;
    duration: number;
    learnings: string;
    difficulty: string;
    description: string;
    name: string;
    notionId: string;
    slug: string;
    slides: Slide[];
};

describe("Given an Bankless Academy loader", () => {
    const loader = courseLoader;

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

        expect(jobSchedulerStub.scheduledJobs[0].info).toEqual(loader.info);
    });
});
