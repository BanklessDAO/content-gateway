import { JobDescriptor } from "./JobDescriptor";

/**
 * Contains the information of a scheduled loading
 * job that's executing.
 */
export type Job<T> = {
    execututionStartedAt: Date;
} & JobDescriptor<T>;
