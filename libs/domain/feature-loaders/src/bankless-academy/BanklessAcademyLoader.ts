import { DataLoader } from "@shared/util-loaders";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import axios from "axios";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";

const name = "bankless-academy-loader";
const logger = new Logger({ name });

/// Types

const courseInfo = {
    namespace: "bankless-academy",
    name: "Course",
    version: "V1",
};

class Quiz {
    @Required(true)
    @CollectionOf(String)
    answers: [string];
    @Required(true)
    rightAnswerNumber: number;
}

class Section {
    @Required(true)
    type: string;
    @Required(true)
    title: string;
    @Required(false)
    content: string;
    @Required(false)
    quiz: Quiz;
    @Required(false)
    component: string;
}

@AdditionalProperties(false)
class Course {
    @Required(true)
    id: string;
    @Required(true)
    name: string;
    @Required(true)
    slug: string;
    @Required(false)
    notionId: string;
    @Required(false)
    poapEventId: number;
    @Required(true)
    description: string;
    @Required(true)
    duration: number;
    @Required(true)
    difficulty: string;
    @Required(false)
    poapImageLink: string;
    @Required(true)
    learnings: string;
    @Required(true)
    learningActions: string;
    @Required(true)
    knowledgeRequirements: string;
    @Required(true)
    @CollectionOf(Section)
    sections: Section[];
}

/// Loader

export const banklessAcademyLoader: DataLoader<Course> = {
    name: name,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing Bankless Academy loader...");
        return pipe(
            client.register(courseInfo, Course),
            TE.chainW(() =>
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: new Date(),
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
        return TE.of([]);
    },
    save: ({ client, currentJob }) => {
        // TODO: use types and type guards for item + slide
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing Bankless Academy loader.");
                    logger.info("Current job:", currentJob);

                    const response = await axios.get(
                        `https://bankless-academy-cg-lab.vercel.app/api/courses`
                    );
                    return response.data.map((item) => {
                        return {
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
                            sections: item.slides.map((slide) => {
                                return {
                                    type: slide.type,
                                    title: slide.title,
                                    content: slide.content,
                                    // TODO: Add quiz support
                                    component: slide.component,
                                };
                            }),
                        };
                    });
                },
                (err: unknown) => new Error(String(err))
            ),
            TE.chain((courses) => client.saveBatch(courseInfo, courses)),
            TE.chain(() =>
                TE.right({
                    name: name,
                    scheduledAt: DateTime.now().plus({ minutes: 1 }).toJSDate(),
                })
            ),
            TE.mapLeft((error) => {
                logger.error("Bankless Academy data loading failed:", error);
                return error;
            })
        );
    },
};
