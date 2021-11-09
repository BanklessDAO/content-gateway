import { createSimpleLoader } from "@shared/util-loaders";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
import axios from "axios";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";

const name = "bankless-academy-loader";
const logger = new Logger({ name });

/// Types

const typeVersions = {
    quiz: {
        namespace: "bankless-academy",
        name: "Quiz",
        version: "V1",
    },
    section: {
        namespace: "bankless-academy",
        name: "Section",
        version: "V1",
    },
    course: {
        namespace: "bankless-academy",
        name: "Course",
        version: "V1",
    },
    courseLibrary: {
        namespace: "bankless-academy",
        name: "CourseLibrary",
        version: "V1",
    },
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

@AdditionalProperties(false)
class CourseLibrary {
    @Required(true)
    id: string;
    @Required(true)
    @CollectionOf(Course)
    courses: Course[];
}

/// Loader

export const banklessAcademyLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        logger.info("Initializing Bankless Academy loader...");
        return pipe(
            client.register(typeVersions.course, Course),
            TE.map((result) => {
                logger.info("Registration result:", result);
                return result;
            }),
            TE.chainW(() =>
                jobScheduler.schedule({
                    name: name,
                    scheduledAt: DateTime.now(),
                })
            ),
            TE.map((result) => {
                logger.info(`Scheduled job`, result);
            })
        );
    },
    load: ({ client, currentJob }) => {
        // TODO: use types and type guards for item + slide
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing Bankless Academy loader.");
                    logger.info(`Current job:`, currentJob);

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
            TE.chain((courses) =>
                client.saveBatch(typeVersions.course, courses)
            ),
            TE.chain(() =>
                TE.right({
                    name: name,
                    // runs every minute
                    scheduledAt: DateTime.now().plus({ minutes: 1 }),
                })
            )
        );
    },
});
