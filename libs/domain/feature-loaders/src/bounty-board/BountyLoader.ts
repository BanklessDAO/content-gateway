import { notEmpty } from "@banklessdao/util-misc";
import { LoadContext, ScheduleMode } from "@shared/util-loaders";
import {
    Data,
    Nested,
    NonEmptyProperty,
    OptionalObjectRef,
    OptionalProperty,
    RequiredArrayRef,
    RequiredObjectRef,
} from "@banklessdao/util-schema";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { HTTPDataLoaderBase } from "../base/HTTPDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const INFO = {
    namespace: "bankless-bounty-board",
    name: "Bounty",
    version: "V1",
};

@Nested()
class DiscordUser {
    @NonEmptyProperty()
    discordHandle: string;
    @NonEmptyProperty()
    discordId: string;
}

@Nested()
class Reward {
    @NonEmptyProperty()
    currency: string;
    @NonEmptyProperty()
    amount: number;
    @NonEmptyProperty()
    scale: number;
}

@Nested()
class StatusEvent {
    @NonEmptyProperty()
    status: string;
    @NonEmptyProperty()
    setAt: number;
}

@Data({
    info: INFO,
})
class Bounty {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    season: number;
    @NonEmptyProperty()
    title: string;
    @NonEmptyProperty()
    description: string;
    @NonEmptyProperty()
    criteria: string;
    @NonEmptyProperty()
    status: string;
    @NonEmptyProperty()
    customerId: string;
    @RequiredObjectRef(Reward)
    reward: Reward;
    @RequiredArrayRef(StatusEvent)
    statusHistory: StatusEvent[];

    @NonEmptyProperty()
    dueAt: number;
    @NonEmptyProperty()
    createdAt: number;
    @OptionalObjectRef(DiscordUser)
    createdBy: DiscordUser;

    @OptionalProperty()
    claimedAt?: number;
    @OptionalObjectRef(DiscordUser)
    claimedBy?: DiscordUser;
    @OptionalProperty()
    submittedAt?: number;
    @OptionalObjectRef(DiscordUser)
    submittedBy?: DiscordUser;
    @OptionalProperty()
    reviewedAt?: number;
    @OptionalObjectRef(DiscordUser)
    reviewedBy?: DiscordUser;

    @OptionalProperty()
    discordMessageId?: string;
    @OptionalProperty()
    submissionNotes?: string;
    @OptionalProperty()
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
        claimedAt: t.string,
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
                        claimedAt: bounty.claimedAt
                            ? Date.parse(bounty.claimedAt)
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
