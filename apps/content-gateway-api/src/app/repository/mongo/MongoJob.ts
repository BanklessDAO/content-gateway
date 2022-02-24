import { JobState, ScheduleMode } from "@shared/util-loaders";

export type MongoJobLog = {
    note: string;
    state: JobState;
    info: Record<string, unknown>;
    createdAt: Date;
};

export type MongoJob = {
    name: string;
    state: JobState;
    scheduleMode: ScheduleMode;
    cursor: string;
    limit: number;
    currentFailCount: number;
    previousScheduledAt?: Date;
    scheduledAt: Date;
    updatedAt: Date;
    logs: MongoJobLog[];
    foo: string;
};
