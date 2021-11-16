import { notEmpty } from "@shared/util-fp";
import { createGraphQLAPIClient, DataLoader } from "@shared/util-loaders";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS } from "./queries";
import { BANKAccount, bankAccountInfo } from "./types";

const name = "bankless-token-loader";
const logger = new Logger({ name });

const subgraphURI =
    "https://api.thegraph.com/subgraphs/name/0xnshuman/bank-subgraph";
const graphAPIClient = createGraphQLAPIClient(subgraphURI);

type Event = {
    value: string;
    from: {
        id: string;
    };
    to: {
        id: string;
    };
};

type Balance = {
    value: string;
    transferToEvent: Event[];
    transferFromEvent: Event[];
};

type Account = {
    id: string;
    ERC20balances: Balance[];
};

const mapAccounts = (accounts: Account[]): BANKAccount[] =>
    accounts
        .map((account) => {
            const acc: BANKAccount = {
                id: account.id,
                address: account.id,
                balance: 0.0,
                transactions: [],
            };
            try {
                const balances = account.ERC20balances;
                const balance = balances[0];
                const transfersTo = balance.transferToEvent;
                const transfersFrom = balance.transferFromEvent;
                const allTransfers = transfersTo.concat(transfersFrom);
                acc.balance = balance.value ? parseFloat(balance.value) : 0.0;
                acc.transactions = allTransfers.map((transfer) => ({
                    fromAddress: transfer.from.id,
                    toAddress: transfer.to.id,
                    amount: transfer.value ? parseFloat(transfer.value) : 0.0,
                }));
                return acc;
            } catch (err) {
                logger.warn(
                    `There was an error parsing bank account:`,
                    account,
                    err
                );
                return null;
            }
        })
        .filter(notEmpty);

export const banklessTokenLoader: DataLoader<BANKAccount> = {
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return pipe(
            client.register(bankAccountInfo, BANKAccount),
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
    load: ({ cursor, limit }) => {
        // TODO: start using loadFrom / limit once we have the dates in place
        return TE.tryCatch(
            () => {
                logger.info("Loading Bankless Token data:", {
                    cursor,
                    limit,
                });

                return graphAPIClient.query(
                    BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS,
                    { count: limit, offsetID: "" }, // TODO: 👈 use cursor here
                    (data) => {
                        logger.info(
                            `Loaded data chunk from the original source:`
                        );
                        logger.info(
                            `Total count: ${data.accounts}; OffsetID: ${cursor} `
                        );
                        return mapAccounts(data.accounts);
                    }
                );
            },
            (err: unknown) => new Error(String(err))
        );
    },
    save: ({ client, data }) => {
        const nextJob = {
            name: name,
            scheduledAt: DateTime.now().plus({ minutes: 30 }).toJSDate(),
            cursor: 0, // TODO: use proper timestamps
            limit: 1000,
        };
        return pipe(
            client.saveBatch(bankAccountInfo, data),
            TE.chain(() => TE.right(nextJob)),
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
