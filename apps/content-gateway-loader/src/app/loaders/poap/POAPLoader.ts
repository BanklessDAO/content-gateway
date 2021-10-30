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

var totalCount = 0
const pullTokensSince = (id) => {
    return graphAPIClient
        .query(
            POAP_TOKEN_SUBGRAPH_TOKENS, 
            { count: 1000, offsetID: id }, 
            (data) => { 
                totalCount += 1000
                logger.info(`Loaded data chunk from the original source:`);
                logger.info(`Total count: ${ totalCount }; OffsetID: ${ id }`);

                return mapTokens(data.tokens)
            }
        );
}

export const poapLoader = createSimpleLoader({
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
                        console.log(`Tokens slice total count: ${ tokensSlice.length }`)

                        if (tokensSlice.length == 0) {
                            lastTokenID = null
                            totalCount = 0
                        }else {
                            lastTokenID = tokensSlice[tokensSlice.length - 1].id
                        }

                        tokens = tokens.concat(tokensSlice)
                        console.log(`Tokens total count: ${ tokens.length }`)

                        lastTokenID = null // Limit this to a single slice for now
                    }

                    console.log(`Sample token: ${ JSON.stringify(tokens[1], null, 2) }`)

                    client.save(typeVersions.poapTokenIndex, {
                        id: "0",
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
