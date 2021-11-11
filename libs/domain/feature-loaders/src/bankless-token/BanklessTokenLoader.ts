import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { createGraphQLAPIClient, DataLoader } from "@shared/util-loaders";
import { BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS } from "./queries";
import { BANKAccount, bankAccountInfo } from "./types";

const name = "bankless-token-loader";
const logger = new Logger({ name });

const subgraphURI =
    "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph";
const graphAPIClient = createGraphQLAPIClient(subgraphURI);

// TODO: create a type for `accounts`
const mapAccounts = (accounts) => {
    return accounts
        .map(function (account) {
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

            acc.id = account.id;
            acc.address = account.id;

            try {
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
                console.log(`Spotted account with missing data: ${acc.id}`);
                return null;
            }
        })
        .filter((account) => account);
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

export const banklessTokenLoader: DataLoader = {
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return pipe(
            client.register(bankAccountInfo, BANKAccount),
            TE.chainW(() =>
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: new Date(),
                })
            ),
            TE.map((result) => {
                logger.info("Scheduled job", result);
                return undefined;
            }),
            TE.mapLeft((error) => {
                logger.error(
                    "Bankless Token Loader initialization failed:",
                    error
                );
                return error;
            })
        );
    },
    save: ({ client, currentJob }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing Bankless Token loader.");
                    logger.info("Current job:", currentJob);

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
                    return accounts;
                },
                (err: unknown) => new Error(String(err))
            ),
            TE.chain((accounts) => client.saveBatch(bankAccountInfo, accounts)),
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ minutes: 1 }).toJSDate(),
                })
            ),
            TE.mapLeft((error) => {
                logger.error(
                    "Bankless Token Loader data loading failed:",
                    error
                );
                return error;
            })
        );
    },
};
