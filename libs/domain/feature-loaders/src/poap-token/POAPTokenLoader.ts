import { createLogger, notEmpty } from "@shared/util-fp";
import { createGraphQLAPIClient, DataLoader } from "@shared/util-loaders";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { POAP_TOKEN_SUBGRAPH_TOKENS } from "./queries";
import { POAPToken, poapTokenInfo } from "./types";

const logger = createLogger("POAPLoader");
const graphAPIClient = createGraphQLAPIClient(
    "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai"
);

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

const batchSize = 1000;

export const poapTokenLoader: DataLoader<POAPToken> = {
    info: poapTokenInfo,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing POAP loader...");
        return pipe(
            client.register(poapTokenInfo, POAPToken),
            TE.chainW(() =>
                // TODO: we don't want to restart everything when the loader is restarted 👇
                jobScheduler.schedule({
                    info: poapTokenInfo,
                    scheduledAt: new Date(),
                    cursor: 0,
                    limit: batchSize,
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
            logger.info(
                `POAP data length: ${data.length}, setting cursor to: ${
                    data[data.length - 1].mintedAt
                }`
            );
            cursor = data[data.length - 1].mintedAt;
        } else {
            cursor = 0;
        }
        const cadence =
            data.length == batchSize ? { seconds: 30 } : { minutes: 5 };
        const nextJob = {
            info: poapTokenInfo,
            scheduledAt: DateTime.now().plus(cadence).toJSDate(),
            cursor: cursor,
            limit: batchSize,
        };
        return pipe(
            client.saveBatch({
                info: poapTokenInfo,
                data: data,
                cursor: cursor,
            }),
            TE.chain(() => TE.right(nextJob)),
            TE.mapLeft((error) => {
                logger.error("POAP Loader data loading failed:", error);
                return error;
            })
        );
    },
};
