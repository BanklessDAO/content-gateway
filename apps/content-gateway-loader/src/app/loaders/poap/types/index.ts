import { Required, CollectionOf } from "@tsed/schema";

export const typeVersions = {
    poapToken: {
        namespace: "poap",
        name: "POAPToken",
        version: "V1",
    },
    poapTokenIndex: {
        namespace: "poap",
        name: "POAPTokenIndex",
        version: "V1",
    }
};

export class POAPToken {
    @Required(true)
    id: string;
    @Required(true)
    owner: string;
    @Required(true)
    mintedAt: number;
}

export class POAPTokenIndex {
    @Required(true)
    @CollectionOf(POAPToken)
    tokens: POAPToken[];
}