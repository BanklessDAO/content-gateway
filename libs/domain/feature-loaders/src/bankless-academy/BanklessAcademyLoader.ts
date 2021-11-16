import { DataLoader } from "@shared/util-loaders";
import axios from "axios";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { Course, courseInfo } from "./types";

const name = "bankless-academy-loader";
const logger = new Logger({ name });

// TODO: use discriminated unions (discriminator is type)
type Slide = {
    type: string;
    title: string;
    content?: string;
    quiz?: Record<string, unknown>;
    component?: string;
};

type ResponseItem = {
    poapImageLink: string;
    learningActions: string;
    knowledgeRequirements: string;
    poapEventId: number;
    duration: number;
    learnings: string;
    difficulty: string;
    description: string;
    name: string;
    notionId: string;
    slug: string;
    slides: Slide[];
};

export const banklessAcademyLoader: DataLoader<Course> = {
    name: name,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing Bankless Academy loader...");
        return pipe(
            client.register(courseInfo, Course),
            TE.chainW(() =>
                // TODO: we don't want to restart everything when the loader is restarted 👇
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: new Date(),
                    cursor: 0,
                    limit: 1000,
                })
            ),
            TE.map((result) => {
                logger.info("Scheduled job", result);
            }),
            TE.mapLeft((error) => {
                logger.error(
                    "Error while initializing Bankless Academy loader:",
                    error
                );
                return error;
            })
        );
    },
    load: ({ cursor, limit }) => {
        // TODO: use loadFrom & limit
        logger.info("Loading Bankless Academy data:", {
            cursor,
            limit,
        });
        return TE.tryCatch(
            async () => {
                const response = await axios.request<ResponseItem[]>({
                    url: "https://bankless-academy-cg-lab.vercel.app/api/courses",
                });
                return response.data.map((item: ResponseItem) => {
                    const course: Course = {
                        id: item.slug,
                        name: item.name,
                        slug: item.slug,
                        notionId: item.notionId,
                        poapEventId: item.poapEventId,
                        description: item.description,
                        duration: item.duration,
                        difficulty: item.difficulty,
                        poapImageLink: item.poapImageLink,
                        learnings: item.learnings,
                        learningActions: item.learningActions,
                        knowledgeRequirements: item.knowledgeRequirements,
                        sections: item.slides
                            .filter((slide) => slide.content)
                            .map((slide) => {
                                return {
                                    type: slide.type,
                                    title: slide.title,
                                    content: slide.content,
                                    // TODO: Add quiz support
                                    component: slide.component,
                                };
                            }),
                    };
                    return course;
                });
            },
            (err: unknown) => new Error(String(err))
        );
    },
    save: ({ client, data }) => {
        const nextJob = {
            name: name,
            scheduledAt: DateTime.now().plus({ minutes: 1 }).toJSDate(),
            cursor: 0, // TODO: use proper timestamps
            limit: 1000,
        };
        return pipe(
            client.saveBatch(courseInfo, data),
            TE.chain(() => TE.right(nextJob)),
            TE.mapLeft((error) => {
                logger.error("Bankless Academy data loading failed:", error);
                return error;
            })
        );
    },
};
