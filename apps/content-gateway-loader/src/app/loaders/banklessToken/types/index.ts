import { Required, CollectionOf } from "@tsed/schema";

export const typeVersions = {
    transaction: {
        namespace: "bankless-token",
        name: "Transaction",
        version: "V1",
    },
    bankAccount: {
        namespace: "bankless-token",
        name: "BANKAccount",
        version: "V1",
    },
    banklessTokenIndex: {
        namespace: "bankless-token",
        name: "BanklessTokenIndex",
        version: "V1",
    }
};

export class Transaction {
    @Required(true)
    fromAddress: string;
    @Required(true)
    toAddress: string;
    @Required(true)
    amount: number;
}

export class BANKAccount {
    @Required(true)
    address: string;
    @Required(true)
    balance: number;
    @Required(true)
    @CollectionOf(Transaction)
    transactions: Transaction[];
}

export class BanklessTokenIndex {
    @Required(true)
    @CollectionOf(BANKAccount)
    accounts: BANKAccount[];
}