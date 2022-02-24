import { notEmpty } from "@banklessdao/util-misc";
import {
    LoadContext,
    ScheduleMode,
    DataLoaderBase,
    DEFAULT_CURSOR,
} from "@shared/util-loaders";

import { UnknownError } from "@banklessdao/util-data";
import {
    Data,
    Nested,
    NonEmptyProperty,
    RequiredObjectRef,
    OptionalProperty,
    RequiredArrayRef,
} from "@banklessdao/util-schema";
import { TextChannel, Client, Intents, Collection, Message } from "discord.js";
import * as TE from "fp-ts/lib/TaskEither";

const INFO = {
    namespace: "bankless-discord",
    name: "announcements",
    version: "V1",
};

@Nested()
class DiscordAuthor {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    username: string;
    @OptionalProperty()
    avatar?: string;
}

@Nested()
class DiscordAttachment {
    @NonEmptyProperty()
    id: string;
    @OptionalProperty()
    name?: string;
    @NonEmptyProperty()
    url: string;
    @NonEmptyProperty()
    proxyURL: string;
    @OptionalProperty()
    size?: number;
    @OptionalProperty()
    height?: number;
    @OptionalProperty()
    width?: number;
    @OptionalProperty()
    contentType?: string;
}

@Data({
    info: INFO,
})
class DiscordMessage {
    @NonEmptyProperty()
    id: string;
    @OptionalProperty()
    content?: string;
    @NonEmptyProperty()
    createdAt: number;
    @RequiredObjectRef(DiscordAuthor)
    author: DiscordAuthor;
    @RequiredArrayRef(DiscordAuthor)
    mentions: DiscordAuthor[];
    @RequiredArrayRef(DiscordAttachment)
    attachments: DiscordAttachment[];
}

type DiscordFetchResult = Collection<string, Message>;

export class DiscordLoader extends DataLoaderBase<
    DiscordFetchResult,
    DiscordMessage
> {
    public info = INFO;

    // Discord doesn't allow 1000 here
    protected batchSize = 100;
    protected type = DiscordMessage;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    private token: string;
    private channelId: string;

    client = new Client({
        intents: [
            Intents.FLAGS.GUILDS,
            Intents.FLAGS.DIRECT_MESSAGES,
            Intents.FLAGS.GUILD_MESSAGES,
        ],
    });

    constructor(token: string, channelId: string) {
        super();
        this.token = token;
        this.channelId = channelId;
        this.client.login(this.token);
    }

    protected loadRaw(context: LoadContext) {
        return TE.tryCatch(
            () => {
                const channel = this.client.channels.cache.get(
                    this.channelId
                ) as TextChannel;

                return channel.messages.fetch({
                    limit: this.batchSize,
                    after: context.cursor,
                });
            },
            (err: unknown) => {
                return new UnknownError(err);
            }
        );
    }

    protected mapResult(rawData: DiscordFetchResult): Array<DiscordMessage> {
        return rawData
            .map((rawData) => ({
                id: rawData.id,
                content: rawData.content,
                createdAt: rawData.createdAt.getTime(),
                author: {
                    id: rawData.author.id,
                    username: rawData.author.username,
                    avatar: rawData.author.avatar ?? undefined,
                },
                mentions: rawData.mentions.users.map((author) => ({
                    id: author.id,
                    username: author.username,
                    avatar: author.avatar ?? undefined,
                })),
                attachments: rawData.attachments.map((attachment) => ({
                    id: attachment.id,
                    name: attachment.name ?? undefined,
                    url: attachment.url,
                    proxyURL: attachment.proxyURL,
                    size: attachment.size,
                    height: attachment.height ?? undefined,
                    width: attachment.width ?? undefined,
                    contentType: attachment.contentType ?? undefined,
                })),
            }))
            .filter(notEmpty);
    }

    protected extractCursor(result: DiscordFetchResult) {
        return result.at(result.size - 1)?.id || DEFAULT_CURSOR;
    }
}

export const createDiscordLoader = (token: string, channelId: string) =>
    new DiscordLoader(token, channelId);
