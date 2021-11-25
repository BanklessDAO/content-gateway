import { AdditionalProperties, Required } from "@tsed/schema";

export const poapTokenInfo = {
    namespace: "poap",
    name: "POAPToken",
    version: "V1",
};

@AdditionalProperties(false)
export class POAPToken {
    @Required(true)
    id: string;
    @Required(true)
    transferCount: number;
    @Required(true)
    mintedAt: number;
    @Required(true)
    ownerId: string;
    @Required(true)
    eventId: string;
}

export const poapAccountInfo = {
    namespace: "poap",
    name: "POAPAccount",
    version: "V1",
};

@AdditionalProperties(false)
export class POAPAccount {
    @Required(true)
    id: string;
    @Required(true)
    tokensOwned: number;
}
