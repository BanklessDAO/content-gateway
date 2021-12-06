/* eslint-disable @typescript-eslint/ban-types */
import { Allow, CollectionOf, Required } from "@tsed/schema";
import { keys } from "ts-transformer-keys";
import { Data, Property } from ".";

@Data({
    namespace: "test",
    name: "Tag",
    version: "V1",
})
class Tag {
    @Required(true)
    text: string;
}

const poapEventInfo = {
    namespace: "test",
    name: "POAPEvent",
    version: "V1",
};

@Data({
    namespace: "test",
    name: "POAPEvent",
    version: "V1",
})
class POAPEvent {
    id: string;
    description: string;
    createdAt: string;
}

describe("test", () => {
    it("test", () => {
        // const keysOfProps = keys<POAPEvent>();

        // console.log(keysOfProps);
    });
});
