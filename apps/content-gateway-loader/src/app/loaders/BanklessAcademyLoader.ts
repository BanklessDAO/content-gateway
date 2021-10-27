import { Required, CollectionOf } from "@tsed/schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import { Logger } from "tslog";
import { createSimpleLoader } from "..";

const logger = new Logger({ name: "BanklessAcademyLoader" });

const name = "bankless-academy-loader";

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
    }
};

class Quiz {
    @Required(true)
    @CollectionOf(String)
    answers: [string]
    @Required(true)
    rightAnswerNumber: number
}

class Section {
    @Required(true)
    type: string
    @Required(true)
    title: string
    @Required(false)
    content: string
    @Required(false)
    quiz: Quiz
    @Required(false)
    component: string
}

class Course {
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

export const banklessAcademyLoader = createSimpleLoader({
    name: name,
    initialize: ({ client, jobScheduler }) => {
        return TE.tryCatch(
            async () => {
                logger.info("Initializing Bankless Academy loader...");
                client.register(typeVersions.quiz, Quiz);
                client.register(typeVersions.section, Section);
                client.register(typeVersions.course, Course);
                const result = await jobScheduler.schedule({
                    name: name,
                    scheduledAt: DateTime.now(),
                });
                logger.info(`Scheduled job ${JSON.stringify(result)}`);
            },
            (error: Error) => new Error(error.message)
        );
    },
    load: ({ client, currentJob }) => {
        return pipe(
            TE.tryCatch(
                async () => {
                    logger.info("Executing Bankless Academy loader.");
                    logger.info(`Current job: ${currentJob}`);

                    // TODO: Pull the actual data from the Bankless Academy API

                    await client.save(typeVersions.course, {
                        name: "Lorem Ipsum",
                        slug: "Lorem Ipsum",
                        notionId: "Lorem Ipsum",
                        poapEventId: 123,
                        description: "Lorem Ipsum",
                        duration: 123,
                        difficulty: "Lorem Ipsum",
                        poapImageLink: "Lorem Ipsum",
                        learnings: "Lorem Ipsum",
                        learningActions: "Lorem Ipsum",
                        knowledgeRequirements: "Lorem Ipsum",
                        sections: [
                            {
                                type: "Lorem Ipsum",
                                title: "Lorem Ipsum",
                                content: "Lorem Ipsum",
                                quiz: {
                                    answers: [
                                        "One",
                                        "Two",
                                        "Three"
                                    ],
                                    rightAnswerNumber: 1
                                },
                                component: "Lorem Ipsum"
                            }
                        ]
                    });
                },
                (error: Error) => new Error(error.message)
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
