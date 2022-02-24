import { ProgramError } from "@banklessdao/util-data";
import { isLeft } from "fp-ts/lib/Either";
import { TaskEither } from "fp-ts/lib/TaskEither";
import {
    AsyncTask,
    SimpleIntervalJob,
    SimpleIntervalSchedule,
} from "toad-scheduler";
import { Logger } from "tslog";
import { MaintenanceJobError } from "./errors";

/**
 * A job designed to perform maintenance tasks on the gateway
 */
export interface MaintenanceJob {
    id: string;
    run: () => TaskEither<MaintenanceJobError, void>;
    schedule: SimpleIntervalSchedule;
}

export type addMaintenanceJob = (
    job: MaintenanceJob
) => TaskEither<ProgramError, void>;

export const makeToToadJob =
    (logger: Logger) =>
    (job: MaintenanceJob): SimpleIntervalJob => {
        const task = new AsyncTask(job.id, () => {
            return job
                .run()()
                .then(
                    (v) => {
                        if (isLeft(v))
                            throw v.left.error || new Error("Unknown Cause");
                        logger.info(`Maintenance Job ${job.id} successful`)
                    },
                    (err) => {
                        logger.warn(`Maintenance Job ${job.id} failed`, err);
                    }
                );
        });
        return new SimpleIntervalJob(job.schedule, task, job.id);
    };
