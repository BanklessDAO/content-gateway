import { ProgramError, UnknownError } from "@banklessdao/util-data";
import { createLogger } from "@banklessdao/util-misc";
import {
    ClassType,
    SchemaInfo,
    schemaInfoToString
} from "@banklessdao/util-schema";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";

import { DateTime, DurationLike } from "luxon";
import { Logger } from "tslog";
import {
    DataLoader,
    DEFAULT_CURSOR,
    InitContext,
    JobDescriptor,
    LoadContext,
    SaveContext
} from ".";
import { ScheduleMode } from "./scheduler/ScheduleMode";

export type CadenceConfig = {
    [key in ScheduleMode]: DurationLike;
};

/**
 * This class implements the [Template Method  Pattern](https://en.wikipedia.org/wiki/Template_method_pattern)
 * for loading data. Please refer to the abstract and protected methods below for more information.
 */
export abstract class DataLoaderBase<R, M> implements DataLoader<M> {
    // public
    abstract info: SchemaInfo;

    // protected
    protected logger: Logger = createLogger(this.constructor.name);


    protected abstract type: ClassType<M>;
    protected abstract batchSize: number;
    protected abstract cadenceConfig: CadenceConfig;

    // template methods with required implementations
    /**
     * Maps the API result of type `R` to an array of domain objects of type `T`.
     */
    protected abstract mapResult(result: R): Array<M>;

    /**
     * Extracts the cursor value from a domain object.
     * This is usually an `id` or a `createdAt` field.
     */
    protected abstract extractCursor(result: R): string;

    /**
     * Template method that is called as part of the load process.
     * This must return the raw data that is later mapped to the
     * result object.
     */
    protected abstract loadRaw(
        context: LoadContext
    ): TE.TaskEither<ProgramError, R>;

    // template methods with defaults

    /**
     * Template method that is called before the default implementation
     * of initialize. Use it to customize initialization.
     */
    protected preInitialize(
        context: InitContext
    ): TE.TaskEither<ProgramError, InitContext> {
        return TE.right(context);
    }

    /**
     * Template method that is called before the default implementation
     * of load. Use it to customize loading.
     */
    protected preLoad(
        context: LoadContext
    ): TE.TaskEither<ProgramError, LoadContext> {
        return TE.right(context);
    }

    /**
     * Template method that encapsulates how the cursor is calculated.
     * By default it is the cursor of the last item in the collection
     * or the last cursor if the result is empty.
     */
    protected getNextCursor(params: {
        rawResult: R;
        mappedResult: Array<M>;
        loadContext: LoadContext;
    }) {
        const { rawResult, mappedResult, loadContext } = params;
        return mappedResult.length > 0
            ? this.extractCursor(rawResult)
            : loadContext.cursor
            ? String(loadContext.cursor)
            : DEFAULT_CURSOR;
    }

    // * implementation of the {@link DataLoader} interface. You're not supposed
    // * to touch this.

    public initialize(context: InitContext) {
        this.logger.info(
            `Initializing ${schemaInfoToString(this.info)} loader...`
        );
        return pipe(
            TE.Do,
            TE.bind("ctx", () => this.preInitialize(context)),
            TE.mapLeft((error) => {
                this.logger.error("preInitialize failed", error);
                return error;
            }),
            TE.bindW("registrationResult", ({ ctx }) =>
                ctx.client.register({ info: this.info, type: this.type })
            ),
            TE.mapLeft((error) => {
                this.logger.error("Client registration failed", error);
                return error;
            }),
            TE.bindW("jobSchedule", ({ ctx }) => {
                return pipe(
                    ctx.jobs.findJob(this.info),
                    TO.map((maybeJob) => {
                        return (
                            maybeJob ?? {
                                info: this.info,
                                scheduledAt: new Date(),
                                cursor: DEFAULT_CURSOR,
                                limit: this.batchSize,
                                scheduleMode: ScheduleMode.BACKFILL,
                            }
                        );
                    }),
                    TE.fromTaskOption(
                        () => new UnknownError("This shouldn't have happened.")
                    )
                );
            }),
            TE.chainW(({ ctx, jobSchedule }) => ctx.jobs.schedule(jobSchedule)),
            TE.map((result) => {
                this.logger.info("Scheduled job", result);
            }),
            TE.mapLeft((error) => {
                this.logger.error(
                    `${schemaInfoToString(
                        this.info
                    )} Loader initialization failed:`,
                    error
                );
                return error;
            })
        );
    }

    public load(context: LoadContext) {
        return pipe(
            TE.Do,
            TE.bind("loadContext", () => this.preLoad(context)),
            TE.bind("rawResult", ({ loadContext }) =>
                this.loadRaw(loadContext)
            ),
            TE.bindW("mappedResult", ({ rawResult }) => {
                return TE.tryCatch(
                    async () => this.mapResult(rawResult),
                    (e) => new UnknownError(e)
                );
            }),
            TE.map((params) => {
                return {
                    cursor: this.getNextCursor(params),
                    data: params.mappedResult,
                };
            })
        );
    }

    public save({ client, loadingResult }: SaveContext<M>) {
        const { cursor, data } = loadingResult;
        const scheduleMode =
            data.length == this.batchSize
                ? ScheduleMode.BACKFILL
                : ScheduleMode.INCREMENTAL;
        const cadence = this.cadenceConfig[scheduleMode];
        const nextJob: JobDescriptor = {
            info: this.info,
            scheduledAt: DateTime.now().plus(cadence).toJSDate(),
            limit: this.batchSize,
            cursor,
            scheduleMode,
        };
        return pipe(
            client.save({ info: this.info, data }),
            TE.chain(() => TE.right(nextJob)),
            TE.mapLeft((error) => {
                this.logger.error(
                    `${schemaInfoToString(this.info)} data loading failed:`,
                    error
                );
                return error;
            })
        );
    }
}
