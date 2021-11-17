import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";

export const banklessTokenInfo = {
    namespace: "bankless-token",
    name: "BanklessToken",
    version: "V1",
};

export class Transaction {
    @Required(true)
    fromAddress: string;
    @Required(true)
    toAddress: string;
    @Required(true)
    amount: number;
}

@AdditionalProperties(false)
export class BanklessToken {
    @Required(true)
    id: string;
    @Required(true)
    address: string;
    @Required(true)
    balance: number;
    @Required(true)
    @CollectionOf(Transaction)
    transactions: Transaction[];
}
