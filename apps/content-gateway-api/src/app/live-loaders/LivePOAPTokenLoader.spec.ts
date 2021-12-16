import { extractRight } from "@banklessdao/util-misc";
import { createLivePOAPTokenLoader } from ".";

describe("A Live POAP Token Loader", () => {
    const target = createLivePOAPTokenLoader();
    it("Works", async () => {
        const result = extractRight(
            await target.load({
                address: "0x648aa14e4424e0825a5ce739c8c68610e143fb79",
            })()
        );
        expect(result).toBeTruthy();
    });
});
