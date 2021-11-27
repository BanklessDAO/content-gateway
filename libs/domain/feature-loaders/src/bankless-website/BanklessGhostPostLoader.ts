import { notEmpty } from "@shared/util-fp";
import { LoadContext } from "@shared/util-loaders";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { HTTPDataLoaderBase } from "../base/HTTPDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const INFO = {
    namespace: "bankless-website",
    name: "post",
    version: "V1",
};

class BanklessWebsiteTag {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
    @Required(true)
    slug: string;
    @Required(true)
    visibility: string;
    @Required(true)
    url: string;
}

class BanklessWebsiteAuthor {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
    @Required(true)
    slug: string;
    @Required(true)
    url: string;
    @Required(true)
    bio: string;
}

@AdditionalProperties(false)
class BaklessWebsitePost {
    @Required(true)
    id: string;
    @Required(true)
    uuid: string;
    @Required(true)
    title: string;
    @Required(true)
    slug: string;
    @Required(true)
    html: string;
    @Required(true)
    commentId: string;
    @Required(true)
    featureImage: string;
    @Required(true)
    featured: boolean;
    @Required(true)
    visibility: string;
    @Required(true)
    emailRecipientFilter: string;
    @Required(true)
    createdAt: number;
    @Required(true)
    updatedAt: number;
    @Required(true)
    publishedAt: number;
    @Required(true)
    customExcerpt: string;
    @Required(true)
    url: string;
    @Required(true)
    excerpt: string;
    @Required(true)
    readingTime: number;
    @Required(true)
    access: boolean;
    @Required(true)
    sendEmailWhenPublished: boolean;
    @Required(true)
    @CollectionOf(BanklessWebsiteTag)
    tags: BanklessWebsiteTag[];
    @Required(true)
    @CollectionOf(BanklessWebsiteAuthor)
    authors: BanklessWebsiteAuthor[];

    @Required(false)
    canonicalUrl?: string;
    @Required(false)
    emailSubject?: string;
}

const GhostTag = t.strict({
    id: t.string,
    name: t.string,
    slug: t.string,
    visibility: t.string,
    url: t.string,
    description: t.union([t.string, t.null]),
    feature_image: t.union([t.string, t.null]),
    og_image: t.union([t.string, t.null]),
    og_description: t.union([t.string, t.null]),
    twitter_image: t.union([t.string, t.null]),
    twitter_title: t.union([t.string, t.null]),
    twitter_description: t.union([t.string, t.null]),
    meta_title: t.union([t.string, t.null]),
    meta_description: t.union([t.string, t.null]),
    codeinjection_head: t.union([t.string, t.null]),
    codeinjection_foot: t.union([t.string, t.null]),
    canonical_url: t.union([t.string, t.null]),
    accent_color: t.union([t.string, t.null]),
});

const GhostAuthor = t.strict({
    id: t.string,
    name: t.string,
    slug: t.string,
    url: t.string,
    bio: t.string,
    profile_image: t.union([t.string, t.null]),
    cover_image: t.union([t.string, t.null]),
    website: t.union([t.string, t.null]),
    location: t.union([t.string, t.null]),
    facebook: t.union([t.string, t.null]),
    twitter: t.union([t.string, t.null]),
    meta_title: t.union([t.string, t.null]),
    meta_description: t.union([t.string, t.null]),
});

const GhostPost = t.strict({
    id: withMessage(t.string, () => "id is required"),
    uuid: withMessage(t.string, () => "uuid is required"),
    title: withMessage(t.string, () => "Title is required"),
    slug: withMessage(t.string, () => "slug is required"),
    html: withMessage(t.string, () => "html must be a string"),
    url: withMessage(t.string, () => "url is required"),
    featured: withMessage(t.boolean, () => "featured must be a boolean"),
    visibility: withMessage(t.string, () => "visibility must be a string"),
    created_at: withMessage(t.string, () => "created_at must be a string"),
    updated_at: withMessage(t.string, () => "updated_at must be a string"),
    published_at: withMessage(
        t.string,
        () => "published_at must be a valid date"
    ),
    comment_id: withMessage(t.string, () => "comment_id is required"),
    feature_image: withMessage(t.string, () => "feature_image is required"),
    email_recipient_filter: withMessage(
        t.string,
        () => "email_recipient_filter is required"
    ),
    custom_excerpt: withMessage(t.string, () => "custom_excerpt is required"),
    excerpt: withMessage(t.string, () => "Excerpt must be a string"),
    reading_time: withMessage(t.number, () => "reading_time must be a number"),
    access: withMessage(t.boolean, () => "access is required"),
    send_email_when_published: withMessage(
        t.boolean,
        () => "send_email_when_published is required"
    ),
    canonical_url: t.union([t.string, t.null]),
    email_subject: t.union([t.string, t.null]),
    tags: t.array(GhostTag),
    authors: t.array(GhostAuthor),
});

const GhostMeta = t.strict({
    pagination: t.strict({
        page: t.number,
        limit: t.number,
        pages: t.number,
        total: t.number,
        next: t.union([t.number, t.null]),
        prev: t.union([t.number, t.null]),
    }),
});

const GhostPostResponse = t.strict({
    posts: t.array(GhostPost),
    meta: GhostMeta,
});

type GhostPostResponse = t.TypeOf<typeof GhostPostResponse>;

export class BanklessWebsitePostLoader extends HTTPDataLoaderBase<
    GhostPostResponse,
    BaklessWebsitePost
> {
    public info = INFO;

    protected batchSize = BATCH_SIZE;
    protected type = BaklessWebsitePost;
    protected cadenceConfig = {
        fullBatch: { seconds: 5 },
        partialBatch: { minutes: 5 },
    };

    protected codec = GhostPostResponse;

    private ghostApiKey: string;

    constructor(ghostApiKey: string) {
        super();
        this.ghostApiKey = ghostApiKey;
    }

    protected getUrlFor({ cursor }: LoadContext) {
        return `https://gobankless.ghost.io/ghost/api/v3/content/posts/?key=${this.ghostApiKey}&include=tags,authors&page=${cursor}`;
    }

    protected mapResult(result: GhostPostResponse): Array<BaklessWebsitePost> {
        return result.posts
            .map((post) => {
                try {
                    return {
                        id: post.id,
                        uuid: post.uuid,
                        title: post.title,
                        slug: post.slug,
                        html: post.html,
                        commentId: post.comment_id,
                        featureImage: post.feature_image,
                        featured: post.featured,
                        visibility: post.visibility,
                        emailRecipientFilter: post.email_recipient_filter,
                        createdAt: Date.parse(post.created_at),
                        updatedAt: Date.parse(post.updated_at),
                        publishedAt: Date.parse(post.published_at),
                        customExcerpt: post.custom_excerpt,
                        url: post.url,
                        excerpt: post.excerpt,
                        readingTime: post.reading_time,
                        access: post.access,
                        sendEmailWhenPublished: post.send_email_when_published,
                        tags: post.tags.map((tag) => ({
                            id: tag.id,
                            name: tag.name,
                            slug: tag.slug,
                            visibility: tag.visibility,
                            url: tag.url,
                        })),
                        authors: post.authors.map((author) => ({
                            id: author.id,
                            name: author.name,
                            slug: author.slug,
                            url: author.url,
                            bio: author.bio,
                        })),
                        canonicalUrl: post.canonical_url ?? undefined,
                    };
                } catch (e) {
                    this.logger.warn(`Processing POAP event failed`, e, post);
                    return undefined;
                }
            })
            .filter(notEmpty);
    }

    protected extractCursor(result: GhostPostResponse) {
        return `${result.meta.pagination.next ?? 1}`;
    }
}

export const createBanklessWebsitePostLoader = (ghostApiKey: string) =>
    new BanklessWebsitePostLoader(ghostApiKey);
