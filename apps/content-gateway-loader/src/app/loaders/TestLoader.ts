import { Required } from "@tsed/schema";
import { Logger } from "tslog";
import { createSimpleLoader } from "..";
import * as TE from "fp-ts/TaskEither";
import { pipe } from "fp-ts/lib/function";
import { DateTime } from "luxon";

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
        return pipe(
            TE.tryCatch(
                () => {
                    logger.info("Initializing example loader...");
                    client.register(info, CurrentTimestamp);
                    return jobScheduler.schedule({
                        name: name,
                        scheduledAt: DateTime.now(),
                    });
                },
                (error: Error) => new Error(error.message)
            ),
            TE.map((result) => {
                logger.info(`Scheduled job ${JSON.stringify(result)}`);
                return undefined;
            })
        );
    },
    load: ({ client, currentJob }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing example loader.");
                    logger.info(`current job: ${currentJob}`);
                    await client.save(info, {
                        value: DateTime.local().toMillis(),
                    });
                },
                (error: Error) => error
            ),
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ minutes: 15 }),
                })
            )
        );
    },
});
