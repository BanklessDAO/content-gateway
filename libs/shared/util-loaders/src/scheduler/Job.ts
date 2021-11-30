import { JobDescriptor } from ".";
import { JobState } from "./JobState";

/**
 * Contains the metadata for a job.
 */
export type Job = {
    readonly state: JobState;
    readonly previousScheduledAt?: Date;
    readonly currentFailCount: number;
    readonly updatedAt: Date;
} & JobDescriptor;
