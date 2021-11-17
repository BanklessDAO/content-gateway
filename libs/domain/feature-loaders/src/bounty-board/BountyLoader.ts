import { createLogger, notEmpty } from "@shared/util-fp";
import { DataLoader } from "@shared/util-loaders";
import axios from "axios";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Bounty, bountyInfo } from "./types";

const logger = createLogger("BountyBoardLoader");

type StatusHistoryItem = {
    status: string;
    setAt: string;
};

type Reward = {
    currency: string;
    amount: number;
    scale: number;
};

type DiscordUser = {
    discordHandle: string;
    discordId: string;
};

type ServerResponse = {
    data: ResponseItem[];
};

type ResponseItem = {
    statusHistory: StatusHistoryItem[];
    _id: string;
    season: number;
    title: string;
    description: string;
    criteria: string;
    status: string;
    discordMessageId: string;
    submissionNotes?: string;
    submissionUrl?: string;
    reward: Reward;
    createdBy: DiscordUser;
    claimedBy: DiscordUser;
    submittedBy: DiscordUser;
    reviewedBy: DiscordUser;
    // timestamps 👇
    createdAt: string;
    dueAt: string;
    claimedAt: string;
    submittedAt: string;
    reviewedAt: string;
};

export const bountyLoader: DataLoader<Bounty> = {
    info: bountyInfo,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing Bounty Board loader...");
        return pipe(
            client.register(bountyInfo, Bounty),
            TE.chainW(() =>
                // TODO: we don't want to restart everything when the loader is restarted 👇
                jobScheduler.schedule({
                    info: bountyInfo,
                    scheduledAt: new Date(),
                    cursor: 0,
                    limit: 1000,
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
    load: ({ cursor, limit }) => {
        // TODO: start using loadFrom / limit once we have the dates in place
        return TE.tryCatch(
            async () => {
                logger.info("Loading Bounty Board data:", {
                    cursor,
                    limit,
                });

                const response = await axios.request<ServerResponse>({
                    url: "https://bountyboard.bankless.community/api/bounties",
                });

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
                        } catch (err) {
                            logger.warn(
                                `There was an error parsing bounty item ${item._id}`,
                                err
                            );
                            return null;
                        }
                    })
                    .filter(notEmpty);
            },
            (err: unknown) => new Error(String(err))
        );
    },
    save: ({ client, data }) => {
        const nextJob = {
            info: bountyInfo,
            scheduledAt: DateTime.now().plus({ minutes: 30 }).toJSDate(),
            cursor: 0, // TODO: 👈 use proper timestamps 👇
            limit: 1000,
        };
        return pipe(
            client.saveBatch({ info: bountyInfo, data: data, cursor: 0 }),
            TE.chain(() => TE.right(nextJob)),
            TE.mapLeft((error) => {
                logger.error("Bounty Board Loader data loading failed:", error);
                return error;
            })
        );
    },
};
