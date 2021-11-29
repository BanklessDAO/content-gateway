import { JobDescriptor } from ".";
import { JobState } from "./JobState";
import { ScheduleMode } from "./ScheduleMode";

/**
 * Contains the metadata for a job.
 */
export type Job = {
    readonly state: JobState;
    readonly scheduleMode: ScheduleMode;
    readonly previousScheduledAt?: Date;
    readonly currentFailCount: number;
    readonly updatedAt: Date;
} & JobDescriptor;
