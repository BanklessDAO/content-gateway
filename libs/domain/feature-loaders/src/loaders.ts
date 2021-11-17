import { DataLoader } from "@shared/util-loaders";
import {
    banklessTokenLoader,
    bountyLoader,
    courseLoader
} from ".";
// TODO: if I import this 👇 like the others there 👆 then poapTokenLoader is undefined! 😐
import {
    poapTokenLoader
} from "./poap-token/POAPTokenLoader";


/**
 * 📗 Note for developers: this is where you should add your loader(s).
 */
export const loaders = [
    courseLoader,
    banklessTokenLoader,
    bountyLoader,
    poapTokenLoader,
] as DataLoader<unknown>[];
