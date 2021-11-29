import { notEmpty } from "@shared/util-fp";
import { LoadContext, ScheduleMode } from "@shared/util-loaders";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { HTTPDataLoaderBase } from "../base/HTTPDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const INFO = {
    namespace: "bankless-bounty-board",
    name: "Bounty",
    version: "V1",
};

class DiscordUser {
    @Required(true)
    discordHandle: string;
    @Required(true)
    discordId: string;
}

class Reward {
    @Required(true)
    currency: string;
    @Required(true)
    amount: number;
    @Required(true)
    scale: number;
}

class StatusEvent {
    @Required(true)
    status: string;
    @Required(true)
    setAt: number;
}

@AdditionalProperties(false)
class Bounty {
    @Required(true)
    id: string;
    @Required(true)
    season: number;
    @Required(true)
    title: string;
    @Required(true)
    description: string;
    @Required(true)
    criteria: string;
    @Required(true)
    status: string;
    @Required(true)
    customerId: string;
    @Required(true)
    reward: Reward;
    @Required(true)
    @CollectionOf(StatusEvent)
    statusHistory: StatusEvent[];

    @Required(true)
    dueAt: number;
    @Required(true)
    createdAt: number;
    @Required(true)
    createdBy: DiscordUser;

    @Required(false)
    claimedAt?: number;
    @Required(false)
    claimedBy?: DiscordUser;
    @Required(false)
    submittedAt?: number;
    @Required(false)
    submittedBy?: DiscordUser;
    @Required(false)
    reviewedAt?: number;
    @Required(false)
    reviewedBy?: DiscordUser;

    @Required(false)
    discordMessageId?: string;
    @Required(false)
    submissionNotes?: string;
    @Required(false)
    submissionUrl?: string;
}

const APIDiscordUser = t.strict({
    discordHandle: withMessage(t.string, () => "Discord handle is required"),
    discordId: withMessage(t.string, () => "Discord ID is required"),
});

const APIReward = t.strict({
    currency: withMessage(t.string, () => "currency is required"),
    amount: withMessage(t.number, () => "amount is required"),
    scale: withMessage(t.number, () => "scale is required"),
});

const APIStatusEvent = t.strict({
    status: withMessage(t.string, () => "status is required"),
    setAt: withMessage(t.string, () => "setAt is required"),
});

const APIBounty = t.intersection([
    t.strict({
        _id: withMessage(t.string, () => "id is required"),
        season: withMessage(t.number, () => "season is required"),
        title: withMessage(t.string, () => "title is required"),
        description: withMessage(t.string, () => "description is required"),
        criteria: withMessage(t.string, () => "criteria is required"),
        status: withMessage(t.string, () => "status is required"),
        customer_id: withMessage(t.string, () => "customer_id is required"),
        reward: withMessage(APIReward, () => "reward is required"),
        statusHistory: withMessage(
            t.array(APIStatusEvent),
            () => "statusHistory is required"
        ),
        dueAt: withMessage(t.string, () => "dueAt is required"),
        createdAt: withMessage(t.string, () => "createdAt is required"),
        createdBy: withMessage(APIDiscordUser, () => "createdBy is required"),
    }),
    t.partial({
        submissionNotes: t.union([t.string, t.null]),
        submissionUrl: t.union([t.string, t.null]),
        discordMessageId: t.string,
        submittedAt: t.string,
        submittedBy: APIDiscordUser,
        reviewedAt: t.string,
        reviewedBy: APIDiscordUser,
        clamiedAt: t.string,
        claimedBy: APIDiscordUser,
    }),
]);

const APIBounties = t.strict({
    success: t.boolean,
    data: t.array(APIBounty),
});

type APIBounties = t.TypeOf<typeof APIBounties>;

export class BountyLoader extends HTTPDataLoaderBase<APIBounties, Bounty> {
    public info = INFO;

    protected batchSize = BATCH_SIZE;
    protected type = Bounty;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected codec = APIBounties;

    protected getUrlFor({ limit, cursor }: LoadContext) {
        return `https://bountyboard.bankless.community/api/bounties`;
    }

    protected mapResult(result: APIBounties): Array<Bounty> {
        return result.data
            .map((bounty) => {
                try {
                    return {
                        id: bounty._id,
                        statusHistory: bounty.statusHistory.map(
                            (statusEvent) => ({
                                status: statusEvent.status,
                                setAt: Date.parse(statusEvent.setAt),
                            })
                        ),
                        season: bounty.season,
                        title: bounty.title,
                        description: bounty.description,
                        criteria: bounty.criteria,
                        reward: {
                            currency: bounty.reward.currency,
                            amount: bounty.reward.amount,
                            scale: bounty.reward.scale,
                        },
                        createdBy: {
                            discordHandle: bounty.createdBy.discordHandle,
                            discordId: bounty.createdBy.discordId,
                        },
                        createdAt: Date.parse(bounty.createdAt),
                        status: bounty.status,
                        dueAt: Date.parse(bounty.dueAt),
                        discordMessageId: bounty.discordMessageId,
                        claimedAt: bounty.clamiedAt
                            ? Date.parse(bounty.clamiedAt)
                            : undefined,
                        claimedBy: bounty.claimedBy
                            ? {
                                  discordHandle: bounty.claimedBy.discordHandle,
                                  discordId: bounty.claimedBy.discordId,
                              }
                            : undefined,
                        submissionNotes: bounty.submissionNotes ?? undefined,
                        submissionUrl: bounty.submissionUrl ?? undefined,
                        submittedAt: bounty.submittedAt
                            ? Date.parse(bounty.submittedAt)
                            : undefined,
                        submittedBy: bounty.submittedBy
                            ? {
                                  discordHandle:
                                      bounty.submittedBy.discordHandle,
                                  discordId: bounty.submittedBy.discordId,
                              }
                            : undefined,
                        reviewedAt: bounty.reviewedAt
                            ? Date.parse(bounty.reviewedAt)
                            : undefined,
                        reviewedBy: bounty.reviewedBy
                            ? {
                                  discordHandle:
                                      bounty.reviewedBy.discordHandle,
                                  discordId: bounty.reviewedBy.discordId,
                              }
                            : undefined,
                        customerId: bounty.customer_id,
                    };
                } catch (e) {
                    this.logger.warn(`Processing Bounty failed`, e, bounty);
                    return undefined;
                }
            })
            .filter(notEmpty);
    }

    protected extractCursor(result: APIBounties) {
        return `0`;
    }
}

export const createBountyLoader: () => BountyLoader = () => new BountyLoader();
