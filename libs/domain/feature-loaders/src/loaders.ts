import { DataLoader } from "@shared/util-loaders";
import {
    createBANKAccountLoader,
    createBountyLoader,
    createBanklessAcademyCourseLoader,
    createPOAPAccountLoader,
    createPOAPTokenLoader
} from ".";
import { createBanklessPodcastLoader } from "./bankless-podcast";
import { createBANKTransactionLoader } from "./bankless-token/BanklessTokenTransactionLoader";
import { createBANKTransferLoader } from "./bankless-token/BanklessTokenTransferLoader";
import { createBanklessWebsitePostLoader } from "./bankless-website/BanklessGhostPostLoader";
import { createPOAPEventLoader } from "./poap-token/POAPEventLoader";
import { createPOAPTransferLoader } from "./poap-token/POAPTransferLoader";

export type ApiKeys = {
    youtubeApiKey: string;
    ghostApiKey: string;
};

/**
 * 📗 Note for developers: this is where you should add your loader(s).
 */
export const createLoaders = (apiKeys: ApiKeys) =>
    [
        createBanklessAcademyCourseLoader(),
        createBountyLoader(),
        createBanklessPodcastLoader(apiKeys.youtubeApiKey),
        createBanklessWebsitePostLoader(apiKeys.ghostApiKey),
        createBANKAccountLoader(),
        createBANKTransactionLoader(),
        createBANKTransferLoader(),
        createPOAPEventLoader(),
        createPOAPTokenLoader(),
        createPOAPAccountLoader(),
        createPOAPTransferLoader(),
    ] as DataLoader<unknown>[];
