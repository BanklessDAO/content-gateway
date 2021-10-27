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
     * The cursor is an arbitrary number (timestamp in our case) that represents
     * he point where we "left off" since the last batch was loaded.
     * More info [here](http://mysql.rjweb.org/doc.php/pagination).
     */
    cursor?: DateTime;
    /**
     * The nubmer of items to load.
     */
    limit?: bigint;
    /**
     * Arbitrary data that you can save with the job.
     */
    data?: T;
};
