import {
    createGraphQLAPIClient,
    createSimpleLoader,
} from "@shared/util-loaders";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { POAP_TOKEN_SUBGRAPH_TOKENS } from "./data/network/graph/queries";
import { info, POAPToken } from "./types";

const logger = new Logger({ name: "POAPLoader" });
const subgraphURI =
    "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai";
const graphAPIClient = createGraphQLAPIClient(subgraphURI);
const name = "poap-loader";

// TODO: use types and type guards for token/tokens (io-ts?)
const mapTokens = (tokens) => {
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
        .filter((token) => token);
};

let totalCount = 0;
const pullTokensSince = (id: string) => {
    return graphAPIClient.query(
        POAP_TOKEN_SUBGRAPH_TOKENS,
        { count: 1000, offsetID: id },
        (data) => {
            totalCount += 1000;
            logger.info(`Loaded data chunk from the original source:`);
            logger.info(`Total count: ${totalCount}; OffsetID: ${id}`);

            return mapTokens(data.tokens);
        }
    );
};

export const poapLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing POAP loader...");
        client.register(info, POAPToken);
        return pipe(
            jobScheduler.schedule({
                name: name,
                scheduledAt: DateTime.now(),
            }),
            TE.map((result) => {
                logger.info(`Scheduled job ${JSON.stringify(result)}`);
            })
        );
    },
    load: ({ client, currentJob }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing POAP loader.");
                    logger.info(`Current job: ${currentJob}`);

                    let tokens = [];
                    let lastTokenID = "";

                    while (lastTokenID != null) {
                        const tokensSlice = await pullTokensSince(lastTokenID);
                        console.log(
                            `Tokens slice total count: ${tokensSlice.length}`
                        );

                        if (tokensSlice.length == 0) {
                            lastTokenID = null;
                            totalCount = 0;
                        } else {
                            lastTokenID =
                                tokensSlice[tokensSlice.length - 1].id;
                        }

                        tokens = tokens.concat(tokensSlice);
                        console.log(`Tokens total count: ${tokens.length}`);

                        lastTokenID = null; // Limit this to a single slice for now
                    }

                    console.log(
                        `Sample token: ${JSON.stringify(tokens[1], null, 2)}`
                    );

                    const result = await client.saveBatch(info, tokens);
                    logger.info("Batch saving result:", result);
                },
                (error: unknown) => new Error(String(error))
            ),
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ minutes: 1 }),
                })
            )
        );
    },
});
