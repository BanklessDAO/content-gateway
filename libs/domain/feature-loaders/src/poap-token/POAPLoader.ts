import { notEmpty } from "@shared/util-fp";
import { createGraphQLAPIClient, DataLoader } from "@shared/util-loaders";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { POAP_TOKEN_SUBGRAPH_TOKENS } from "./queries";
import { info, POAPToken } from "./types";

const logger = new Logger({ name: "POAPLoader" });
const graphAPIClient = createGraphQLAPIClient(
    "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai"
);
const name = "poap-loader";

type Token = {
    id: string;
    created: string;
    owner: {
        id: string;
    };
};

const mapTokens = (tokens: Token[]): POAPToken[] => {
    return tokens
        .map((token) => {
            try {
                return {
                    id: token.id,
                    owner: token.owner.id,
                    mintedAt: parseInt(token.created),
                };
            } catch {
                console.log(`Spotted token with corrupt data`);
                return null;
            }
        })
        .filter(notEmpty);
};

let totalCount = 0;

const pullTokensSince = (cursor: number): Promise<POAPToken[]> => {
    return graphAPIClient.query(
        POAP_TOKEN_SUBGRAPH_TOKENS,
        { count: 1000, cursor: cursor },
        (data) => {
            totalCount += data.tokens.length;
            logger.info(`Loaded data chunk from the original source:`);
            logger.info(`Total count: ${totalCount}; cursor: ${cursor}`);
            return mapTokens(data.tokens);
        }
    );
};

export const poapLoader: DataLoader<POAPToken> = {
    name: name,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing POAP loader...");
        return pipe(
            client.register(info, POAPToken),
            TE.chainW(() =>
                // TODO: we don't want to restart everything when the loader is restarted 👇
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: new Date(),
                    cursor: 0,
                    limit: 1000,
                })
            ),
            TE.map((result) => {
                logger.info("Scheduled job", result);
            }),
            TE.mapLeft((error) => {
                logger.error("POAP Loader initialization failed:", error);
                return error;
            })
        );
    },
    load: ({ cursor, limit }) => {
        return TE.tryCatch(
            async () => {
                logger.info("Loading POAP Token data:", {
                    cursor,
                    limit,
                });

                let tokens: POAPToken[] = [];
                let ts = cursor ?? 0;

                while (tokens.length < limit) {
                    logger.info(
                        `Pulling POAP tokens... size: ${tokens.length}, limit: ${limit}, ts: ${ts}`
                    );
                    const slice: POAPToken[] = await pullTokensSince(ts);
                    logger.info(`Pulled ${slice.length} POAP tokens.`);
                    if (slice.length === 0) {
                        break;
                    } else {
                        ts = slice[slice.length - 1].mintedAt;
                    }
                    tokens = tokens.concat(slice);
                }
                if (tokens.length > limit) {
                    logger.info(
                        `Too many POAP tokens were loaded (amount: ${tokens.length}, limit: ${limit}). Truncating list...`
                    );
                    tokens = tokens.slice(0, limit);
                }
                return tokens;
            },
            (error: unknown) => new Error(String(error))
        );
    },
    save: ({ client, data }) => {
        let cursor: number;
        if (data.length > 0) {
            cursor = data[data.length - 1].mintedAt;
        } else {
            cursor = 0;
        }
        const nextJob = {
            name: name,
            scheduledAt: DateTime.now().plus({ minutes: 30 }).toJSDate(),
            cursor: cursor,
            limit: 1000,
        };
        return pipe(
            client.saveBatch(info, data),
            TE.chain(() => TE.right(nextJob)),
            TE.mapLeft((error) => {
                logger.error("POAP Loader data loading failed:", error);
                return error;
            })
        );
    },
};
