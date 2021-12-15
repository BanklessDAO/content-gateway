import { ContentGatewayClientStub, createContentGatewayClientV1 } from "@banklessdao/content-gateway-sdk";
import { createGraphQLClient } from "@shared/util-data";
import { JobSchedulerStub } from "@shared/util-loaders";
import { BANKAccountLoader } from "./TestLoader";

describe("Given an example loader", () => {
    const url = "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph";

    const loader = new BANKAccountLoader(createGraphQLClient(url));

    let clientStub: ContentGatewayClientStub;
    let jobSchedulerStub: JobSchedulerStub;


    beforeEach(() => {
        clientStub = createContentGatewayClientV1;
        jobSchedulerStub = createJobSchedulerStub();
    });

    //                                     async is only supported in `it` 👇
    it("When initialize is called Then it runs successfully", async () => {
        // we await the promise 👇
        const result = await loader.initialize({
            client: clientStub.client,
            jobScheduler: jobSchedulerStub,
        })(); // 👈 note the `()`. This means that we invoke the `TaskEither` to turn it into a `Promise<Either>`
    });
});