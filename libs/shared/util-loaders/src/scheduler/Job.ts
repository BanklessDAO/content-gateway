import { JobState } from "./JobState";

/**
 * Contains the metadata for a scheduled job.
 */
export type Job = {
    name: string;
    state: JobState;
    /**
     * The date and time when the job should run
     */
    scheduledAt: Date;
    /**
     * The cursor is an opaque string (a timestamp or a block time in our case)
     * that represents the point where we "left off" since the last batch was loaded.
     * More info [here](http://mysql.rjweb.org/doc.php/pagination).
     */
    cursor: number;
    limit: number;
};
