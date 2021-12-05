import { createLiveBanklessTokenLoader, createLivePOAPTokenLoader } from ".";

export const liveLoaders = [
    createLiveBanklessTokenLoader(),
    createLivePOAPTokenLoader()
];