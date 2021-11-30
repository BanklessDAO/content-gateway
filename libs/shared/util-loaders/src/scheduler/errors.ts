import { ProgramError, ProgramErrorBase } from "@shared/util-dto";
import { schemaInfoToString } from "@shared/util-schema";
import { Job } from ".";

export class NoLoaderForJobError extends ProgramErrorBase<"NoLoaderForJobError"> {
    constructor(job: Job) {
        super({
            _tag: "NoLoaderForJobError",
            message: `No loader found for name: ${schemaInfoToString(
                job.info
            )}`,
        });
    }
}

export class NoLoaderFoundError extends ProgramErrorBase<"NoLoaderFoundError"> {
    constructor(name: string) {
        super({
            _tag: "NoLoaderFoundError",
            message: `No loader found with name: ${name}`,
        });
    }
}

export class JobCreationError extends ProgramErrorBase<"JobUpsertFailedError"> {
    constructor(job: Job, cause: Error) {
        super({
            _tag: "JobUpsertFailedError",
            message: `Upsert of job with name: ${schemaInfoToString(
                job.info
            )} failed. Cause: ${cause}`,
        });
    }
}

export class SchedulerStartupError extends ProgramErrorBase<"SchedulerStartupError"> {
    constructor(cause: unknown) {
        super({
            _tag: "SchedulerStartupError",
            message: `Couldn't start job scheduler. Cause: ${cause}`,
        });
    }
}

export class SchedulerNotRunningError extends ProgramErrorBase<"SchedulerNotRunningError"> {
    constructor() {
        super({
            _tag: "SchedulerNotRunningError",
            message:
                "The job scheduler is not running. Did you forget to call start?",
        });
    }
}

export class LoaderInitializationError extends ProgramErrorBase<"LoaderInitializationError"> {
    public error: ProgramError;
    constructor(error: ProgramError) {
        super({
            _tag: "LoaderInitializationError",
            message: `Loader failed to initialize: ${error.message}`,
        });
        this.error = error;
    }
}

export class DatabaseError extends ProgramErrorBase<"DatabaseError"> {
    public error: unknown;
    constructor(cause: unknown) {
        super({
            _tag: "DatabaseError",
            message:
                cause instanceof Error
                    ? cause.message
                    : "Unknown error happened. This is probably a bug.",
        });
    }
}

export type SchedulingError =
    | DatabaseError
    | NoLoaderForJobError
    | JobCreationError
    | SchedulerNotRunningError;

export type RegistrationError =
    | SchedulerNotRunningError
    | LoaderInitializationError;

export type RemoveError = SchedulerNotRunningError | DatabaseError;
