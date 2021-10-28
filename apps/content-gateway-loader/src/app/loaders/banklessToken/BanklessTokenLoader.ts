import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { createSimpleLoader } from "../..";
import { typeVersions, BanklessTokenIndex } from "./types";
import DefaultNetworkProvider from '../../data/network/DefaultNetworkProvider'
import { BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS } from "./data/network/graph/queries";

const logger = new Logger({ name: "BanklessTokenLoader" });
const subgraphURI = "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph"
const graphAPIClient = (new DefaultNetworkProvider()).graph(subgraphURI)
const name = "bankless-token-loader";

const mapAccounts = (accounts) => {
    return accounts
        .map(account => {
            return {
                id: account.id,
                address: account.id,
                balance: account.ERC20balances[0].value,
                transactions: account.ERC20balances[0].transferToEvent
                    .concat(account.ERC20balances[0].transferFromEvent)
                    .map(transfer => {
                        return {
                            fromAddress: transfer.from.id,
                            toAddress: transfer.to.id,
                            amount: transfer.value
                        }
                    })
            }
        })
}

const pullAccountsSince = (id) => {
    return graphAPIClient
        .query(
            BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS, 
            { count: 1000, offsetID: id }, 
            (response) => { 
                return mapAccounts(response.data.accounts)
            }
        );
}

export const banklessTokenLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return TE.tryCatch(
            async () => {
                logger.info("Initializing Bankless Token loader...");
                client.register(typeVersions.banklessTokenIndex, BanklessTokenIndex);
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
                    logger.info("Executing Bankless Token loader.");
                    logger.info(`Current job: ${currentJob}`);

                    var accounts = []
                    var lastAccountID = ""

                    while (lastAccountID != null) {
                        const accountsSlice = await pullAccountsSince(lastAccountID)

                        if (accountsSlice.length == 0) {
                            lastAccountID = null
                        }

                        accounts.concat(accountsSlice)
                    }

                    client.save(typeVersions.banklessTokenIndex, {
                        id: "0",
                        accounts: accounts
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
