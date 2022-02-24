import { createLogger } from "@banklessdao/util-misc";
import { DataLoader } from "@shared/util-loaders";
import {
    createBANKAccountLoader,
    createBanklessAcademyCourseLoader,
    createBountyLoader,
    createPOAPAccountLoader,
    createPOAPTokenLoader
} from ".";
import { createBanklessPodcastLoader } from "./bankless-podcast";
import { createBANKTransactionLoader } from "./bankless-token/BanklessTokenTransactionLoader";
import { createBANKTransferLoader } from "./bankless-token/BanklessTokenTransferLoader";
import { createBanklessWebsitePostLoader } from "./bankless-website/BanklessGhostPostLoader";
import { createDiscordLoader } from "./discord/DiscordLoader";
import { createENSDomainLoader } from "./ens/ENSLoader";
import { createPOAPEventLoader } from "./poap-token/POAPEventLoader";
import { createPOAPTransferLoader } from "./poap-token/POAPTransferLoader";
import { createSnapshotProposalLoader } from "./snapshot";

export type LoadersConfig = {
    youtubeApiKey?: string;
    ghostApiKey?: string;
    snapshotSpaces?: string[];
    discordBotToken?: string;
    discordChannel?: string;
};

const logger = createLogger("loaders");

/**
 * 📗 Note for developers: this is where you should add your loader(s).
 */
export const createLoaders = (apiKeys: LoadersConfig) => {
    const loaders = [
        createBanklessAcademyCourseLoader(),
        createBountyLoader(),
        createBANKAccountLoader(),
        createBANKTransactionLoader(),
        createBANKTransferLoader(),
        createPOAPEventLoader(),
        createPOAPTokenLoader(),
        createPOAPAccountLoader(),
        createPOAPTransferLoader(),
        createENSDomainLoader(),
    ] as DataLoader<unknown>[];
    if (apiKeys.youtubeApiKey) {
        loaders.push(
            createBanklessPodcastLoader(
                apiKeys.youtubeApiKey
            ) as DataLoader<unknown>
        );
    } else {
        logger.warn(
            "No youtube api key provided, skipping youtube podcast loader"
        );
    }
    if (apiKeys.ghostApiKey) {
        loaders.push(
            createBanklessWebsitePostLoader(
                apiKeys.ghostApiKey
            ) as DataLoader<unknown>
        );
    } else {
        logger.warn(
            "No ghost api key provided, skipping bankless website post loader"
        );
    }
    if (apiKeys.snapshotSpaces) {
        loaders.push(
            createSnapshotProposalLoader(
                apiKeys.snapshotSpaces
            ) as DataLoader<unknown>
        );
    } else {
        logger.warn("No snapshot spaces provided, skipping snapshot loader");
    }
    if (apiKeys.discordBotToken && apiKeys.discordChannel) {
        loaders.push(
            createDiscordLoader(
                apiKeys.discordBotToken,
                apiKeys.discordChannel
            ) as DataLoader<unknown>
        );
    } else {
        logger.warn(
            "No discord bot token or channel provided, skipping discord loader"
        );
    }
    return loaders;
};
