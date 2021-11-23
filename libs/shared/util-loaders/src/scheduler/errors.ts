import { ProgramErrorBase } from "@shared/util-dto";

export class NoLoaderForJobError extends ProgramErrorBase<"NoLoaderForJobError"> {
    constructor(name: string) {
        super({
            _tag: "NoLoaderForJobError",
            message: `No loader found for name: ${name}`,
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

export class JobCreationFailedError extends ProgramErrorBase<"JobCreationFailedError"> {
    constructor(name: string, cause: Error) {
        super({
            _tag: "JobCreationFailedError",
            message: `Creation of job with name: ${name} failed. Cause: ${cause}`,
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
    public error: Error;
    constructor(error: Error) {
        super({
            _tag: "LoaderInitializationError",
            message: `Loader failed to initialize: ${error.message}`,
        });
        this.error = error;
    }
}

export type SchedulingError =
    | NoLoaderForJobError
    | JobCreationFailedError
    | SchedulerNotRunningError;

export type RegistrationError = SchedulerNotRunningError | LoaderInitializationError;
