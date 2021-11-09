import { AdditionalProperties, Required } from "@tsed/schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { v4 as uuid } from "uuid";
import { createSimpleLoader } from "@shared/util-loaders";

const name = "example-timestamp-loader";

const logger = new Logger({ name });

const info = {
    namespace: "example",
    name: "CurrentTimestamp",
    version: "V1",
};

@AdditionalProperties(false)
class CurrentTimestamp {
    @Required(true)
    id: string;
    @Required(true)
    value: number;
}

export const exampleTimestampLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return pipe(
            client.register(info, CurrentTimestamp),
            TE.chainW(() =>
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: new Date(),
                })
            ),
            TE.map(() => {
                logger.info("Scheduled example timestamp loader...");
                return undefined;
            })
        );
    },
    load: ({ client }) => {
        return pipe(
            client.save(info, {
                id: uuid(),
                value: DateTime.local().toMillis(),
            }),
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ seconds: 5 }).toJSDate(),
                })
            )
        );
    },
});
