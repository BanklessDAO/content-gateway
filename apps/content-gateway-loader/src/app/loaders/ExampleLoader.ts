import { AdditionalProperties, Required } from "@tsed/schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { v4 as uuid } from "uuid";
import { createSimpleLoader } from "..";

const logger = new Logger({ name: "ExampleLoader" });

const info = {
    namespace: "test",
    name: "CurrentTimestamp",
    version: "V2",
};

@AdditionalProperties(false)
class CurrentTimestamp {
    @Required(true)
    id: string;
    @Required(true)
    value: number;
}

const name = "example-loader";

export const exampleLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Initializing example loader...");
                    const result = await client.register(
                        info,
                        CurrentTimestamp
                    );
                    return jobScheduler.schedule({
                        name: name,
                        scheduledAt: DateTime.now(),
                    });
                },
                (error: Error) => new Error(error.message)
            ),
            TE.map((result) => {
                logger.info("Scheduled Example Loader...", result);
                return undefined;
            })
        );
    },
    load: ({ client }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing example loader.");
                    await client.save(info, {
                        id: uuid(),
                        value: DateTime.local().toMillis(),
                    });
                },
                (error: Error) => error
            ),
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ seconds: 5 }),
                })
            )
        );
    },
});
