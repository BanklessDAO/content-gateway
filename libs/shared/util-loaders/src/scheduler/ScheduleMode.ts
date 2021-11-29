export const ScheduleMode = {
    BACKFILL: "BACKFILL",
    INCREMENTAL: "INCREMENTAL",
} as const;

export type ScheduleMode = typeof ScheduleMode[keyof typeof ScheduleMode];
