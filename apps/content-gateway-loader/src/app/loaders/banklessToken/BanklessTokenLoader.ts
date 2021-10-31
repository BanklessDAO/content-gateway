import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { createSimpleLoader } from "../..";
import DefaultNetworkProvider from "../../data/network/DefaultNetworkProvider";
import { BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS } from "./data/network/graph/queries";
import { BanklessTokenIndex, info } from "./types";
import {v4 as uuid} from 'uuid';

const name = "bankless-token-loader";
const logger = new Logger({ name });

const subgraphURI =
    "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph";
const graphAPIClient = new DefaultNetworkProvider().graph(subgraphURI);

const mapAccounts = (accounts) => {
    const mappedAccounts = accounts.map(function (account) {
        const acc = {
            id: "",
            address: "",
            balance: 0.0,
            transactions: [
                {
                    fromAddress: "",
                    toAddress: "",
                    amount: 0.0,
                },
            ],
        };

        try {
            acc.id = account.id;
            acc.address = account.id;

            const balances = account.ERC20balances;
            const balance = balances[0];
            if (balance.value) acc.balance = parseFloat(balance.value);

            const transfersTo = balance.transferToEvent;
            const transfersFrom = balance.transferFromEvent;
            const allTransfers = transfersTo.concat(transfersFrom);

            acc.transactions = allTransfers.map((transfer) => {
                const tr = {
                    fromAddress: transfer.from.id,
                    toAddress: transfer.to.id,
                    amount: 0.0,
                };

                if (transfer.value) tr.amount = parseFloat(transfer.value);

                return tr;
            });

            return acc;
        } catch {
            return acc;
        }
    });

    return mappedAccounts;
};

let totalCount = 0;
const pullAccountsSince = (id) => {
    return graphAPIClient.query(
        BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS,
        { count: 1000, offsetID: id },
        (data) => {
            totalCount += 1000;
            logger.info(`Loaded data chunk from the original source:`);
            logger.info(`Total count: ${totalCount}; OffsetID: ${id}`);

            // logger.info(`Data: ${ JSON.stringify(data) }`)

            return mapAccounts(data.accounts);
        }
    );
};

export const banklessTokenLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return TE.tryCatch(
            async () => {
                logger.info("Initializing Bankless Token loader...");
                // 👇 there was a missing await here
                await client.register(info, BanklessTokenIndex);
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
                    logger.info("Executing Bankless Token loader.");
                    logger.info(`Current job: ${currentJob}`);

                    let accounts = [];
                    let lastAccountID = "";

                    while (lastAccountID != null) {
                        const accountsSlice = await pullAccountsSince(
                            lastAccountID
                        );
                        console.log(
                            `Accounts slice total count: ${accountsSlice.length}`
                        );

                        if (accountsSlice.length == 0) {
                            lastAccountID = null;
                            totalCount = 0;
                        } else {
                            lastAccountID =
                                accountsSlice[accountsSlice.length - 1].id;
                        }

                        accounts = accounts.concat(accountsSlice);
                        console.log(`Accounts total count: ${accounts.length}`);
                    }

                    console.log(
                        `Sample account: ${JSON.stringify(
                            accounts[1],
                            null,
                            2
                        )}`
                    );

                    const result = await client.save(info, {
                        // 👇 "0" is not unique
                        id: uuid(),
                        accounts: accounts,
                    });
                    logger.info("Save result", result);
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
