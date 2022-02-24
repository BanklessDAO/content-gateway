import { attachJobs, Maintainer, MaintenanceJob } from "../maintenance";
import { ToadScheduler } from "toad-scheduler";
import { createLogger } from "@banklessdao/util-misc";

/**
 * Create a maintainer for the MongoDB that will periodically run tasks
 * to keep the database in good condition
 */
export const createMongoMaintainer = (
    jobs: MaintenanceJob[],
    scheduler = new ToadScheduler()
): Maintainer => {
    const logger = createLogger("MongoDB Maintainer");
    attachJobs(jobs, scheduler, logger);
    return {
        jobs,
        stop: scheduler.stop,
    };
};
