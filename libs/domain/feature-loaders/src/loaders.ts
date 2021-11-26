import { DataLoader } from "@shared/util-loaders";
import { createPOAPAccountLoader, createPOAPTokenLoader } from ".";
import { createPOAPEventLoader } from "./poap-token/POAPEventLoader";
import { createPOAPTransferLoader } from "./poap-token/POAPTransferLoader";

/**
 * 📗 Note for developers: this is where you should add your loader(s).
 */
export const createLoaders = () =>
    [
        // courseLoader,
        // banklessTokenLoader,
        // bountyLoader,
        createPOAPEventLoader(),
        createPOAPTokenLoader(),
        createPOAPAccountLoader(),
        createPOAPTransferLoader(),
    ] as DataLoader<unknown>[];
