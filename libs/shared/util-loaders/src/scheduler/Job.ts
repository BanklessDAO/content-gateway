import { JobDescriptor } from ".";
import { JobState } from "./JobState";

/**
 * Contains the metadata for a scheduled job.
 */
export type Job = {
    state: JobState;
} & JobDescriptor;
