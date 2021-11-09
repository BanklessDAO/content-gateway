/**
 * Contains the metadata for a {@link Job}.
 */
export type JobDescriptor = {
    name: string;
    /**
     * The date and time when the job should run
     */
    scheduledAt: Date;
    /**
     * The cursor is an arbitrary number (usually a timestamp) that represents
     * the point where we "left off" since the last batch was loaded.
     * More info [here](http://mysql.rjweb.org/doc.php/pagination).
     */
    cursor?: bigint;
};
