import { Required } from "@tsed/schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { createSimpleLoader } from "..";

const logger = new Logger({ name: "ExampleLoader" });

const info = {
    namespace: "test",
    name: "CurrentTimestamp",
    version: "V1",
};

class CurrentTimestamp {
    @Required(true)
    value: number;
}

const name = "example-loader";

export const exampleLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return TE.tryCatch(
            async () => {
                logger.info("Initializing example loader...");
                client.register(info, CurrentTimestamp);
                const result = await jobScheduler.schedule({
                    name: name,
                    scheduledAt: DateTime.now(),
                });
                logger.info(`Scheduled job ${JSON.stringify(result)}`);
            },
            (error: Error) => new Error(error.message)
        );
    },
    load: ({ client, currentJob, jobScheduler }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing example loader.");
                    logger.info(`current job: ${currentJob}`);
                    await client.save(info, {
                        value: DateTime.local().toMillis(),
                    });
                },
                (error: Error) => new Error(error.message)
            ),
            TE.chain(() =>
                TE.right({
                    name: name,
                    // runs every minute
                    scheduledAt: DateTime.now().plus({ minutes: 1 }),
                })
            )
        );
    },
});
