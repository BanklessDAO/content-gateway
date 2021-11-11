import { DataLoader } from "@shared/util-loaders";
import { AdditionalProperties, Required } from "@tsed/schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { v4 as uuid } from "uuid";

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
    @Required(false)
    likeIt: boolean;
}

export const exampleUUIDLoader: DataLoader = {
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return pipe(
            client.register(info, RandomUUID),
            TE.chainW(() =>
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: new Date(),
                })
            ),
            TE.map(() => {
                logger.info("Scheduled example UUID loader...");
                return undefined;
            })
        );
    },
    save: ({ client }) => {
        return pipe(
            client.save(info, {
                id: uuid(),
            }),
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ seconds: 5 }).toJSDate(),
                })
            )
        );
    },
};
