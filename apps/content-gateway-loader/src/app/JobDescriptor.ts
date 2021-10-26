import { DateTime } from "luxon";
/**
 * Contains the metadata for a {@link Job}.
 */
export type JobDescriptor<T> = {
    name: string;
    /**
     * The date and time when the job should run
     */
    scheduledAt: DateTime;
    /**
     * Arbitrary data that you can save with the job.
     */
    data: T;
};
