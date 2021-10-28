import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { createSimpleLoader } from "../..";
import { typeVersions, POAPTokenIndex } from "./types";
import DefaultNetworkProvider from '../../data/network/DefaultNetworkProvider'
import { POAP_TOKEN_SUBGRAPH_TOKENS } from "./data/network/graph/queries";

const logger = new Logger({ name: "POAPLoader" });
const subgraphURI = "https://api.thegraph.com/subgraphs/name/poap-xyz/poap-xdai"
const graphAPIClient = (new DefaultNetworkProvider()).graph(subgraphURI)
const name = "poap-loader";

const mapTokens = (tokens) => {
    return tokens
        .map(token => {
            return {
                id: token.id,
                owner: token.owner.id,
                mintedAt: token.created
            }
        })
}

const pullTokensSince = (id) => {
    return graphAPIClient
        .query(
            POAP_TOKEN_SUBGRAPH_TOKENS, 
            { count: 1000, offsetID: id }, 
            (response) => { 
                return mapTokens(response.data.tokens)
            }
        );
}

export const POAPLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return TE.tryCatch(
            async () => {
                logger.info("Initializing POAP loader...");
                client.register(typeVersions.poapTokenIndex, POAPTokenIndex);
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
                    logger.info("Executing POAP loader.");
                    logger.info(`Current job: ${currentJob}`);

                    var tokens = []
                    var lastTokenID = ""

                    while (lastTokenID != null) {
                        const tokensSlice = await pullTokensSince(lastTokenID)

                        if (tokensSlice.length == 0) {
                            lastTokenID = null
                        }

                        tokens.concat(tokensSlice)
                    }

                    client.save(typeVersions.poapTokenIndex, {
                        tokens: tokens
                    });
                },
                (error: Error) => new Error(error.message)
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
