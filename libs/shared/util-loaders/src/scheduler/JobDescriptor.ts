import { SchemaInfo } from "@banklessdao/util-schema";
import { ScheduleMode } from "./ScheduleMode";

/**
 * Contains the metadata for a scheduled job.
 */
export type JobDescriptor = {
    readonly info: SchemaInfo;
    /**
     * The date and time when the job should run
     */
    readonly scheduledAt: Date;
    readonly scheduleMode: ScheduleMode,
    /**
     * The cursor is an opaque string (a timestamp or a block time in our case)
     * that represents the point where we "left off" since the last batch was loaded.
     * More info [here](http://mysql.rjweb.org/doc.php/pagination).
     */
    readonly cursor: string;
    /**
     * The amount of records to load.
     */
    readonly limit: number;
};
