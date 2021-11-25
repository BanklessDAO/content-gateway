import { DataLoader } from "@shared/util-loaders";
import { createPOAPAccountLoader, createPOAPTokenLoader } from ".";

/**
 * 📗 Note for developers: this is where you should add your loader(s).
 */
export const createLoaders = () =>
    [
        // courseLoader,
        // banklessTokenLoader,
        // bountyLoader,
        // createPOAPTokenLoader(),
        createPOAPAccountLoader(),
    ] as DataLoader<unknown>[];
