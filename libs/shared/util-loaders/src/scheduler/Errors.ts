export class NoLoaderForJobError extends Error {
    public _tag = "NoLoaderForJobError";

    private constructor(name: string) {
        super(`No loader found for name: ${name}`);
    }

    public static create(name: string): NoLoaderForJobError {
        return new NoLoaderForJobError(name);
    }
}

export class LoaderAlreadyRegisteredError extends Error {
    public _tag = "LoaderAlreadyRegisteredError";

    private constructor(name: string) {
        super(`There is already a loader with name: ${name}`);
    }

    public static create(name: string): LoaderAlreadyRegisteredError {
        return new LoaderAlreadyRegisteredError(name);
    }
}

export class NoLoaderFoundError extends Error {
    public _tag = "NoLoaderFoundError";

    private constructor(name: string) {
        super(`No loader found with name: ${name}`);
    }

    public static create(name: string): NoLoaderFoundError {
        return new NoLoaderFoundError(name);
    }
}

export class JobCreationFailedError extends Error {
    public _tag = "JobCreationFailedError";

    private constructor(name: string, cause: Error) {
        super(`Creation of job with name: ${name} failed. Cause: ${cause}`);
    }

    public static create(name: string, cause: Error): JobCreationFailedError {
        return new JobCreationFailedError(name, cause);
    }
}

export class SchedulerAlreadyStartedError extends Error {
    public _tag = "SchedulerAlreadyStartedError";

    private constructor() {
        super(`This job scheduler has already started.`);
    }

    public static create(): SchedulerAlreadyStartedError {
        return new SchedulerAlreadyStartedError();
    }
}

export class SchedulerStoppedError extends Error {
    public _tag = "SchedulerAlreadyStoppedError";

    private constructor() {
        super(`This job scheduler has already stopped.`);
    }

    public static create(): SchedulerStoppedError {
        return new SchedulerStoppedError();
    }
}

export class SchedulerStartupError extends Error {
    public _tag = "JobSchedulerStartupError";

    private constructor(cause: unknown) {
        super(`Couldn't start job scheduler. Cause: ${cause}`);
    }

    public static create(cause: unknown): SchedulerStartupError {
        return new SchedulerStartupError(cause);
    }
}

export class SchedulerNotStartedError extends Error {
    public _tag = "SchedulerNotStartedError";

    private constructor() {
        super("The job scheduler is not started yet.");
    }

    public static create(): SchedulerNotStartedError {
        return new SchedulerNotStartedError();
    }
}

export type StartError = SchedulerAlreadyStartedError | SchedulerStartupError;

export type SchedulingError =
    | NoLoaderFoundError
    | JobCreationFailedError
    | SchedulerNotStartedError
    | SchedulerStoppedError;

export type RemoveError =
    | NoLoaderFoundError
    | SchedulerNotStartedError
    | SchedulerStoppedError;

export type RegistrationError =
    | LoaderAlreadyRegisteredError
    | SchedulerNotStartedError
    | SchedulerStoppedError
    | Error;
