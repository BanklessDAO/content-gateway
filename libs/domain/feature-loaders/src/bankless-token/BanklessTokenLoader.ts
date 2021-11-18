import { createLogger, notEmpty } from "@shared/util-fp";
import { createGraphQLAPIClient, DataLoader } from "@shared/util-loaders";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS } from "./queries";
import { BanklessToken, banklessTokenInfo } from "./types";

const logger = createLogger("BanklessTokenLoader");

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
    lastTransactionTimestamp: string;
};

const mapAccounts = (accounts: Account[]): BanklessToken[] =>
    accounts
        .map((account) => {
            const acc: BanklessToken = {
                id: account.id,
                address: account.id,
                balance: 0.0,
                transactions: [],
                lastTransactionTimestamp: "0",
            };
            try {
                const balances = account.ERC20balances;
                const balance = balances[0];
                const transfersTo = balance?.transferToEvent ?? [];
                const transfersFrom = balance?.transferFromEvent ?? [];
                const allTransfers = transfersTo.concat(transfersFrom);
                acc.balance = balance?.value ? parseFloat(balance.value) : 0.0;
                acc.transactions = allTransfers.map((transfer) => ({
                    fromAddress: transfer.from.id,
                    toAddress: transfer.to.id,
                    amount: transfer.value ? parseFloat(transfer.value) : 0.0,
                }));
                acc.lastTransactionTimestamp = account.lastTransactionTimestamp;
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

const batchSize = 1000;

export const banklessTokenLoader: DataLoader<BanklessToken> = {
    info: banklessTokenInfo,
    initialize: ({ client, jobScheduler }) => {
        return pipe(
            client.register(banklessTokenInfo, BanklessToken),
            TE.chainW(() =>
                // TODO: we don't want to restart everything when the loader is restarted 👇
                jobScheduler.schedule({
                    info: banklessTokenInfo,
                    scheduledAt: new Date(),
                    cursor: "0",
                    limit: batchSize,
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

                const ts = cursor ?? "0";

                return graphAPIClient.query(
                    BANKLESS_TOKEN_SUBGRAPH_ACCOUNTS,
                    { limit: limit, cursor: ts },
                    (data) => {
                        logger.info(
                            `Loaded data chunk from the original source:`
                        );
                        logger.info(
                            `Total count: ${data.accounts.length}; cursor: ${cursor} `
                        );
                        return mapAccounts(data.accounts);
                    }
                );
            },
            (err: unknown) => new Error(String(err))
        );
    },
    save: ({ client, data }) => {
        const cursor =
            data.length > 0
                ? data[data.length - 1].lastTransactionTimestamp
                : "0";
        const cadence = data.length == batchSize ? { seconds: 30 } : { minutes: 5 };
        const nextJob = {
            info: banklessTokenInfo,
            scheduledAt: DateTime.now().plus(cadence).toJSDate(),
            cursor: cursor,
            limit: batchSize,
        };
        return pipe(
            client.saveBatch({
                info: banklessTokenInfo,
                data: data,
                cursor: cursor,
            }),
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
