import { createSimpleLoader } from "@shared/util-loaders";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import axios from "axios";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";

const logger = new Logger({ name: "BountyBoardLoader" });

const name = "bounty-board-loader";

/// Types

const info = {
    namespace: "bounty-board",
    name: "Bounty",
    version: "V1",
};

// Will be extracted into a global scope later
class Member {
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

@AdditionalProperties(false)
class BountyBoard {
    @Required(true)
    id: string;
    @Required(true)
    @CollectionOf(Bounty)
    bounties: Bounty[];
}

/// Loader

export const bountyBoardLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing Bounty Board loader...");
        return pipe(
            client.register(info, Bounty),
            TE.chainW(() =>
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: new Date(),
                })
            ),
            TE.map((result) => {
                logger.info(`Scheduled job`, result);
                return undefined;
            }),
            TE.mapLeft((error) => {
                logger.error(
                    "Bounty Board Loader initialization failed:",
                    error
                );
                return error;
            })
        );
    },
    load: ({ client, currentJob }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing Bounty Board loader.");
                    logger.info("Current job:", currentJob);

                    const response = await axios.get(
                        `https://bountyboard.bankless.community/api/bounties`
                    );

                    logger.info(
                        `Loaded data from the original source:`
                        // response.data
                    );

                    return response.data.data
                        .map((item) => {
                            try {
                                return {
                                    id:
                                        item.createdBy.discordHandle.toString() +
                                        "-" +
                                        item.createdAt.toString(),
                                    season: item.season.toString(),
                                    title: item.title,
                                    description: item.description,
                                    // criteria: item.criteria,
                                    rewardAmount: item.reward.amount,
                                    // reward: {
                                    //     currency: item.reward.currency,
                                    //     amount: item.reward.amount,
                                    //     scale: item.reward.scale
                                    // },
                                    // createdBy: item.createdBy,
                                    // createdAt: item.createdAt,
                                    // dueAt: item.dueAt,
                                    // discordMessageId: item.discordMessageId,
                                    // status: item.status,
                                    // statusHistory: item.statusHistory
                                    //     .map(event => {
                                    //         return {
                                    //             status: event.status,
                                    //             setAt: event.setAt
                                    //         }
                                    //     }),
                                    // claimedBy: {
                                    //     discordHandle: item.claimedBy.discordHandle,
                                    //     discordId: item.claimedBy.discordId
                                    // },
                                    // claimedAt: item.claimedAt,
                                    // submissionNotes: item.submissionNotes,
                                    // submissionUrl: item.submissionUrl,
                                    // submittedAt: item.submittedAt,
                                    // submittedBy: {
                                    //     discordHandle: item.submittedBy.discordHandle,
                                    //     discordId: item.submittedBy.discordId
                                    // },
                                    // reviewedAt: item.reviewedAt,
                                    // reviewedBy: {
                                    //     discordHandle: item.reviewedBy.discordHandle,
                                    //     discordId: item.reviewedBy.discordId
                                    // }
                                };
                            } catch {
                                return null;
                            }
                        })
                        .filter((b) => b);
                },
                (err: unknown) => new Error(String(err))
            ),
            TE.chain((bounties) => client.saveBatch(info, bounties)),
            TE.chain(() =>
                TE.right({
                    name: name,
                    // runs every minute
                    scheduledAt: DateTime.now().plus({ minutes: 1 }).toJSDate(),
                })
            ),
            TE.mapLeft((error) => {
                logger.error("Bounty Board Loader data loading failed:", error);
                return error;
            })
        );
    },
});
