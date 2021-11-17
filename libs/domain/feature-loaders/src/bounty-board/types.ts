import { AdditionalProperties, Required } from "@tsed/schema";

export const bountyInfo = {
    namespace: "bounty-board",
    name: "Bounty",
    version: "V1",
};

// Will be extracted into a global scope later
export class Member {
    @Required(true)
    discordHandle: string;
    @Required(true)
    discordId: string;
}

export class Reward {
    @Required(true)
    currency: string;
    @Required(true)
    amount: number;
    @Required(true)
    scale: number;
}

export class StatusEvent {
    @Required(true)
    status: string;
    @Required(true)
    setAt: number;
}

@AdditionalProperties(false)
export class Bounty {
    @Required(true)
    id: string;
    @Required(true)
    season: string;
    @Required(true)
    title: string;
    @Required(true)
    description: string;
    // @Required(true)
    // criteria: string;
    @Required(true)
    rewardAmount: number;
    // @Required(true)
    // reward: Reward;
    // @Required(true)
    // createdBy: Member;
    // @Required(true)
    // createdAt: number;
    // @Required(true)
    // dueAt: number;
    // @Required(false)
    // discordMessageId: string;
    // @Required(true)
    // status: string;
    // @Required(true)
    // @CollectionOf(StatusEvent)
    // statusHistory: StatusEvent[];
    // @Required(false)
    // claimedBy: Member;
    // @Required(false)
    // claimedAt: number;
    // @Required(false)
    // submissionNotes: string;
    // @Required(false)
    // submissionUrl: string;
    // @Required(false)
    // submittedAt: number;
    // @Required(false)
    // submittedBy: Member;
    // @Required(false)
    // reviewedAt: number;
    // @Required(false)
    // reviewedBy: Member;
}
