import { JobDescriptor } from "./JobDescriptor";

/**
 * Contains the information of a scheduled loading
 * job that's executing. It has no state because
 * it is implicitly {@link JobState.RUNNING}.
 */
export type Job = {
    execututionStartedAt: Date;
} & JobDescriptor;
