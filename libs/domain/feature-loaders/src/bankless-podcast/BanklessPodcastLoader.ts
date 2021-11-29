import { notEmpty } from "@shared/util-fp";
import {
    DEFAULT_CURSOR,
    LoadContext,
    ScheduleMode,
} from "@shared/util-loaders";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { HTTPDataLoaderBase } from "../base/HTTPDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const INFO = {
    namespace: "bankless-podcast",
    name: "Podcast",
    version: "V1",
};

class Thumbnail {
    @Required(true)
    kind: string;
    @Required(true)
    url: string;
    @Required(true)
    width: number;
    @Required(true)
    height: number;
}

class ResourceId {
    @Required(true)
    kind: string;
    @Required(true)
    videoId: string;
}

class Snippet {
    @Required(true)
    title: string;
    @Required(true)
    channelTitle: string;
    @Required(true)
    playlistId: string;
    @Required(true)
    position: number;
    @Required(true)
    description: string;
    @Required(true)
    channelId: string;
    @Required(true)
    resourceId: ResourceId;
    @Required(true)
    publishedAt: number;

    @Required(false)
    videoOwnerChannelTitle?: string;
    @Required(false)
    videoOwnerChannelId?: string;

    @Required(true)
    @CollectionOf(Thumbnail)
    thumbnails: Thumbnail[];
}

class ContentDetails {
    @Required(false)
    videoId?: string;
    @Required(false)
    videoPublishedAt?: number;
}

class Status {
    @Required(true)
    privacyStatus: string;
}

@AdditionalProperties(false)
class PodcastItem {
    @Required(true)
    id: string;
    @Required(true)
    kind: string;
    @Required(true)
    snippet: Snippet;
    @Required(true)
    contentDetails: ContentDetails;
    @Required(true)
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
