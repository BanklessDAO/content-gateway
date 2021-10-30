import { AdditionalProperties, Required } from "@tsed/schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { v4 as uuid } from "uuid";
import { createSimpleLoader } from "../..";

const name = "example-uuid-loader";

const logger = new Logger({ name });

const info = {
    namespace: "example",
    name: "RandomUUID",
    version: "V1",
};

@AdditionalProperties(false)
class RandomUUID {
    @Required(true)
    id: string;
}

export const exampleUUIDLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Initializing example uuid loader...");
                    // TODO: check the result
                    return await client.register(info, RandomUUID);
                },
                (error: Error) => new Error(error.message)
            ),
            TE.map((result) => {
                logger.info("Scheduled example UUID loader...");
                return undefined;
            })
        );
    },
    load: ({ client }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing example uuid loader.");
                    await client.save(info, {
                        id: uuid(),
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
