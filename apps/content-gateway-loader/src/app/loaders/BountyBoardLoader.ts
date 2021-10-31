import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import axios from "axios";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { v4 as uuid } from "uuid";
import { createSimpleLoader } from "..";

const logger = new Logger({ name: "BountyBoardLoader" });

const name = "bounty-board-loader";

/// Types

const info = {
    namespace: "bounty-board",
    name: "BountyBoard",
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
        return TE.tryCatch(
            async () => {
                logger.info("Initializing Bounty Board loader...");
                await client.register(info, BountyBoard);
                const result = await jobScheduler.schedule({
                    name: name,
                    scheduledAt: DateTime.now(),
                });
                logger.info(`Scheduled job`, result);
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
                        .get(
                            `https://bountyboard.bankless.community/api/bounties`
                        )
                        .then((response) => {
                            logger.info(
                                `Loaded data from the original source:`,
                                // response.data
                            );

                            const bounties = response.data.data.map((item) => {
                                return {
                                    id: item.createdBy.discordHandle.toString() + '-' + item.createdAt.toString(),
                                    season: item.season.toString(),
                                    title: item.title,
                                    description: item.description,
                                    // criteria: item.criteria,
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
                            });

                            const result = client.save(info, {
                                id: uuid(),
                                bounties: bounties,
                            });
                            result.then((res) => {
                                // TODO: return proper errors
                                // logger.info("Save result", res);
                            })
                        });
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
