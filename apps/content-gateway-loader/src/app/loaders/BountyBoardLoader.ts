import { Required, CollectionOf } from "@tsed/schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { createSimpleLoader } from "..";
import axios from 'axios'

const logger = new Logger({ name: "BountyBoardLoader" });

const name = "bounty-board-loader";

/// Types

const typeVersions = {
    member: {
        namespace: "bankless-dao",
        name: "Member",
        version: "V1",
    },
    reward: {
        namespace: "bounty-board",
        name: "Reward",
        version: "V1",
    },
    statusEvent: {
        namespace: "bounty-board",
        name: "StatusEvent",
        version: "V1",
    },
    bounty: {
        namespace: "bounty-board",
        name: "Bounty",
        version: "V1",
    },
    bountyBoard: {
        namespace: "bounty-board",
        name: "BountyBoard",
        version: "V1",
    }
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

class Bounty {
    @Required(true)
    season: string;
    @Required(true)
    title: string;
    @Required(true)
    descrtiption: string;
    @Required(true)
    criteria: string;
    @Required(true)
    reward: Reward;
    @Required(true)
    createdBy: Member;
    @Required(true)
    createdAt: number;
    @Required(true)
    dueAt: number;
    @Required(false)
    discordMessageId: string;
    @Required(true)
    status: string;
    @Required(true)
    @CollectionOf(StatusEvent)
    statusHistory: StatusEvent[];
    @Required(false)
    claimedBy: Member;
    @Required(false)
    claimedAt: number;
    @Required(false)
    submissionNotes: string;
    @Required(false)
    submissionUrl: string;
    @Required(false)
    submittedAt: number;
    @Required(false)
    submittedBy: Member;
    @Required(false)
    reviewedAt: number;
    @Required(false)
    reviewedBy: Member;
}

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
        return TE.tryCatch(
            async () => {
                logger.info("Initializing Bounty Board loader...");
                client.register(typeVersions.bountyBoard, BountyBoard);
                const result = await jobScheduler.schedule({
                    name: name,
                    scheduledAt: DateTime.now(),
                });
                logger.info(`Scheduled job ${JSON.stringify(result)}`);
            },
            (error: Error) => new Error(error.message)
        );
    },
    load: ({ client, currentJob }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing Bounty Board loader.");
                    logger.info(`Current job: ${currentJob}`);

                    await axios
                        .get(`https://bountyboard.bankless.community/api/bounties`)
                        .then((response) => {
                            logger.info(`Loaded data from the original source:`);
                            logger.info(`${JSON.stringify(response.data)}`);

                            let bounties = response.data.data
                                .map(item => {
                                    return {
                                        season: item.season,
                                        title: item.title,
                                        descrtiption: item.descrtiption,
                                        criteria: item.criteria,
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
                                    }
                                })

                            logger.info(``)

                            client.save(typeVersions.bountyBoard, {
                                id: "0",
                                bounties: bounties
                            })
                        })
                },
                (error: Error) => new Error(error.message)
            ),
            TE.chain(() =>
                TE.right({
                    name: name,
                    // runs every minute
                    scheduledAt: DateTime.now().plus({ minutes: 1 }),
                })
            )
        );
    },
});
