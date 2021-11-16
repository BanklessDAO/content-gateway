import { AdditionalProperties, Required } from "@tsed/schema";

export const info = {
    namespace: "poap",
    name: "POAPToken",
    version: "V1",
};

@AdditionalProperties(false)
export class POAPToken {
    @Required(true)
    id: string;
    @Required(true)
    owner: string;
    @Required(true)
    mintedAt: number;
}
