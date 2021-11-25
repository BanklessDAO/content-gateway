import { ProgramError } from "@shared/util-dto";
import { createLogger } from "@shared/util-fp";
import {
    DataLoader,
    InitContext,
    LoadContext,
    LoadingResult,
    SaveContext,
} from "@shared/util-loaders";
import { SchemaInfo, schemaInfoToString } from "@shared/util-schema";
import { Type } from "@tsed/core";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime, DurationLike } from "luxon";
import { Logger } from "tslog";

export type CadenceConfig = {
    /**
     * The next cadence when a full batch is received.
     */
    fullBatch: DurationLike;
    /**
     * The next cadence when a partial batch is received.
     */
    partialBatch: DurationLike;
};

export abstract class DataLoaderBase<T> implements DataLoader<T> {
    abstract info: SchemaInfo;

    protected logger: Logger = createLogger(this.constructor.name);
    protected abstract type: Type<T>;
    protected abstract batchSize: number;
    protected abstract cadenceConfig: CadenceConfig;

    abstract load(
        deps: LoadContext
    ): TE.TaskEither<ProgramError, LoadingResult<T>>;

    protected preInizialize(
        context: InitContext
    ): TE.TaskEither<ProgramError, InitContext> {
        return TE.right(context);
    }

    public initialize(context: InitContext) {
        this.logger.info("Initializing POAP loader...");
        return pipe(
            TE.Do,
            TE.bind("ctx", () => this.preInizialize(context)),
            TE.bindW("registrationResult", ({ ctx }) =>
                ctx.client.register({ info: this.info, type: this.type })
            ),
            TE.mapLeft((error) => {
                this.logger.error("Client registration failed", error);
                return error;
            }),
            TE.chainW(({ ctx }) =>
                // TODO: we don't want to restart everything when the loader is restarted 👇
                ctx.jobScheduler.schedule({
                    info: this.info,
                    scheduledAt: new Date(),
                    cursor: "0",
                    limit: this.batchSize,
                })
            ),
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

    /**
     * Saves the given data to the Content Gateway API and schedules a next job
     * based on the size of the batch.
     */
    public save({ client, loadingResult }: SaveContext<T>) {
        const { cursor, data } = loadingResult;
        const cadence =
            data.length == this.batchSize
                ? this.cadenceConfig.fullBatch
                : this.cadenceConfig.partialBatch;
        const nextJob = {
            info: this.info,
            scheduledAt: DateTime.now().plus(cadence).toJSDate(),
            cursor: cursor,
            limit: this.batchSize,
        };
        return pipe(
            client.saveBatch({ info: this.info, data: data }),
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
