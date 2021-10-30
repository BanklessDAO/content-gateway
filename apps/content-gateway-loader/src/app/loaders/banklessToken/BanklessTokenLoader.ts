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
    let mappedAccounts = accounts
        .map(account => {
            var acc = {
                id: account.id,
                address: account.id,
                balance: 0,
                transactions: [
                    {
                        fromAddress: "",
                        toAddress: "",
                        amount: 0
                    }
                ]
            }
            
            acc.id = account.id
            acc.address = account.id
            if (account.ERC20balances[0].value) acc.balance = parseFloat(account.ERC20balances[0].value)
            acc.transactions = account.ERC20balances[0].transferToEvent
                .concat(account.ERC20balances[0].transferFromEvent)
                .map(transfer => {
                    var tr = {
                        fromAddress: transfer.from.id,
                        toAddress: transfer.to.id,
                        amount: 0
                    }

                    if (transfer.value) tr.amount = parseFloat(transfer.value)

                    return tr
                })
        })

    console.log(mappedAccounts[1])

    return mappedAccounts
}

var totalCount = 0
const pullAccountsSince = (id) => {
    return graphAPIClient
        .query(
            BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS, 
            { count: 1000, offsetID: id }, 
            (data) => { 
                totalCount += 1000
                logger.info(`Loaded data chunk from the original source:`);
                logger.info(`Total count: ${ totalCount }; OffsetID: ${ id }`);

                // logger.info(`Data: ${ JSON.stringify(data) }`)

                return mapAccounts(data.accounts)
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
