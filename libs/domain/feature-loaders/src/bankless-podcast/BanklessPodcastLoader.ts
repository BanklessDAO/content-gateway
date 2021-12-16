import { notEmpty } from "@banklessdao/util-misc";
import {
    DEFAULT_CURSOR,
    LoadContext,
    ScheduleMode
} from "@shared/util-loaders";
import {
    Data,
    Nested,
    NonEmptyProperty,
    OptionalProperty,
    RequiredArrayRef,
    RequiredObjectRef
} from "@banklessdao/util-schema";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { HTTPDataLoaderBase } from "../base/HTTPDataLoaderBase";

const INFO = {
    namespace: "bankless-podcast",
    name: "Podcast",
    version: "V1",
};

@Nested()
class Thumbnail {
    @NonEmptyProperty()
    kind: string;
    @NonEmptyProperty()
    url: string;
    @NonEmptyProperty()
    width: number;
    @NonEmptyProperty()
    height: number;
}

@Nested()
class ResourceId {
    @NonEmptyProperty()
    kind: string;
    @NonEmptyProperty()
    videoId: string;
}

@Nested()
class Snippet {
    @NonEmptyProperty()
    title: string;
    @NonEmptyProperty()
    channelTitle: string;
    @NonEmptyProperty()
    playlistId: string;
    @NonEmptyProperty()
    position: number;
    @NonEmptyProperty()
    description: string;
    @NonEmptyProperty()
    channelId: string;
    @RequiredObjectRef(ResourceId)
    resourceId: ResourceId;
    @NonEmptyProperty()
    publishedAt: number;

    @OptionalProperty()
    videoOwnerChannelTitle?: string;
    @OptionalProperty()
    videoOwnerChannelId?: string;

    @RequiredArrayRef(Thumbnail)
    thumbnails: Thumbnail[];
}

@Nested()
class ContentDetails {
    @OptionalProperty()
    videoId?: string;
    @OptionalProperty()
    videoPublishedAt?: number;
}

@Nested()
class Status {
    @NonEmptyProperty()
    privacyStatus: string;
}

@Data({
    info: INFO,
})
class PodcastItem {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    kind: string;
    @RequiredObjectRef(Snippet)
    snippet: Snippet;
    @RequiredObjectRef(ContentDetails)
    contentDetails: ContentDetails;
    @RequiredObjectRef(Status)
    status: Status;
}

const ThumbnailCodec = t.strict({
    url: t.string,
    width: t.number,
    height: t.number,
});

const YoutubePlaylistItemCodec = t.strict({
    kind: withMessage(
        t.literal("youtube#playlistItem"),
        () => "kind must be 'youtube#playlistItem'"
    ),
    etag: withMessage(t.string, () => "etag must be a string"),
    id: withMessage(t.string, () => "id must be a string"),
    snippet: t.intersection([
        t.strict({
            publishedAt: withMessage(
                t.string,
                () => "publishedAt must be a string"
            ),
            channelId: withMessage(
                t.string,
                () => "channelId must be a string"
            ),
            title: withMessage(t.string, () => "title must be a string"),
            description: withMessage(
                t.string,
                () => "description must be a string"
            ),
            thumbnails: withMessage(
                t.record(t.string, ThumbnailCodec),
                () => "thumbnails are missing"
            ),
            channelTitle: withMessage(
                t.string,
                () => "channelTitle must be a string"
            ),
            playlistId: withMessage(
                t.string,
                () => "playlistId must be a string"
            ),
            position: withMessage(t.number, () => "position must be a number"),
            resourceId: withMessage(
                t.strict({
                    kind: t.string,
                    videoId: t.string,
                }),
                () => "resourceId is missing"
            ),
        }),
        t.partial({
            videoOwnerChannelId: t.string,
            videoOwnerChannelTitle: t.string,
        }),
    ]),
    contentDetails: t.partial({
        videoId: t.string,
        videoPublishedAt: t.string,
    }),
    status: t.strict({
        privacyStatus: withMessage(
            t.string,
            () => "privacyStatus must be a string"
        ),
    }),
});

const YoutubePlaylistCodec = t.intersection([
    t.strict({
        kind: t.string,
        etag: t.string,
        items: t.array(YoutubePlaylistItemCodec),
        pageInfo: t.strict({
            totalResults: t.number,
            resultsPerPage: t.number,
        }),
    }),
    t.partial({
        nextPageToken: t.string,
        prevPageToken: t.string,
    }),
]);

type YoutubePlaylistResponse = t.TypeOf<typeof YoutubePlaylistCodec>;

export class BanklessPodcastLoader extends HTTPDataLoaderBase<
    YoutubePlaylistResponse,
    PodcastItem
> {
    public info = INFO;

    // * this is the maximum that's allowed by the API
    protected batchSize = 50;
    protected type = PodcastItem;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected codec = YoutubePlaylistCodec;

    private youtubeApiKey: string;

    constructor(youtubeApiKey: string) {
        super();
        this.youtubeApiKey = youtubeApiKey;
    }

    protected getUrlFor({ cursor }: LoadContext) {
        const pagination =
            cursor === DEFAULT_CURSOR ? "" : `&pageToken=${cursor}`;
        return `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=PLmkdAgtxf3ahEmMWNY52BX3t1o7vb4aN5&key=${this.youtubeApiKey}&maxResults=50&part=contentDetails,id,snippet,status${pagination}`;
    }

    protected mapResult(result: YoutubePlaylistResponse): Array<PodcastItem> {
        return result.items
            .map((item) => {
                try {
                    return {
                        id: item.id,
                        kind: item.kind,
                        snippet: {
                            title: item.snippet.title,
                            channelTitle: item.snippet.channelTitle,
                            playlistId: item.snippet.playlistId,
                            position: item.snippet.position,
                            description: item.snippet.description,
                            channelId: item.snippet.channelId,
                            videoOwnerChannelTitle:
                                item.snippet.videoOwnerChannelTitle,
                            videoOwnerChannelId:
                                item.snippet.videoOwnerChannelId,
                            resourceId: {
                                kind: item.snippet.resourceId.kind,
                                videoId: item.snippet.resourceId.videoId,
                            },
                            publishedAt: Date.parse(item.snippet.publishedAt),
                            thumbnails: Object.keys(
                                item.snippet.thumbnails
                            ).map((key) => ({
                                kind: key,
                                url: item.snippet.thumbnails[key].url,
                                width: item.snippet.thumbnails[key].width,
                                height: item.snippet.thumbnails[key].height,
                            })),
                        },
                        contentDetails: {
                            videoId: item.contentDetails.videoId,
                            videoPublishedAt: Date.parse(
                                item.snippet.publishedAt
                            ),
                        },
                        status: {
                            privacyStatus: item.status.privacyStatus,
                        },
                    };
                } catch (e) {
                    this.logger.warn(`Processing POAP event failed`, e, item);
                    return undefined;
                }
            })
            .filter(notEmpty);
    }

    protected extractCursor(result: YoutubePlaylistResponse) {
        return `${result.nextPageToken ?? DEFAULT_CURSOR}`;
    }
}

export const createBanklessPodcastLoader = (youtubeApiKey: string) =>
    new BanklessPodcastLoader(youtubeApiKey);
