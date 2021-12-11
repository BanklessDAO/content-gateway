import { notEmpty } from "@shared/util-fp";
import { LoadContext, ScheduleMode } from "@shared/util-loaders";
import {
    Data,
    NonEmptyProperty,
    OptionalObjectRef,
    OptionalProperty,
    RequiredArrayRef,
    RequiredStringArrayOf
} from "@shared/util-schema";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { HTTPDataLoaderBase } from "../base/HTTPDataLoaderBase";
import { BATCH_SIZE } from "../defaults";

const INFO = {
    namespace: "bankless-academy",
    name: "Course",
    version: "V1",
};

class Quiz {
    @RequiredStringArrayOf()
    answers: string[];
    @NonEmptyProperty()
    rightAnswerNumber: number;
    @NonEmptyProperty()
    id: string;
}

class Slide {
    @NonEmptyProperty()
    type: string;
    @NonEmptyProperty()
    title: string;
    @OptionalProperty()
    content?: string;
    @OptionalObjectRef(Quiz)
    quiz?: Quiz;
    @OptionalProperty()
    component?: string;
}

@Data({
    info: INFO,
})
class Course {
    @NonEmptyProperty()
    id: string;
    @NonEmptyProperty()
    poapImageLink: string;
    @NonEmptyProperty()
    learningActions: string;
    @NonEmptyProperty()
    knowledgeRequirements: string;
    @NonEmptyProperty()
    poapEventId: number;
    @NonEmptyProperty()
    duration: number;
    @NonEmptyProperty()
    learnings: string;
    @NonEmptyProperty()
    difficulty: string;
    @NonEmptyProperty()
    description: string;
    @NonEmptyProperty()
    name: string;
    @NonEmptyProperty()
    notionId: string;
    @NonEmptyProperty()
    slug: string;
    @RequiredArrayRef(Slide)
    slides: Slide[];
}

const APIQuiz = t.intersection([
    t.strict({
        rightAnswerNumber: t.number,
        id: t.string,
    }),
    t.partial({
        answer_1: t.string,
        answer_2: t.string,
        answer_3: t.string,
        answer_4: t.string,
    }),
]);

const APISlide = t.union([
    t.strict({
        type: t.literal("LEARN"),
        title: withMessage(t.string, () => "Title is required"),
        content: withMessage(t.string, () => "Content is required"),
    }),
    t.strict({
        type: t.literal("QUIZ"),
        title: withMessage(t.string, () => "Title is required"),
        quiz: withMessage(APIQuiz, () => "Quiz is required"),
    }),
    t.strict({
        type: t.literal("QUEST"),
        title: withMessage(t.string, () => "Title is required"),
        component: withMessage(t.string, () => "Component is required"),
    }),
    t.strict({
        type: t.literal("POAP"),
        title: withMessage(t.string, () => "Title is required"),
    }),
]);

const APICourse = t.strict({
    poapImageLink: t.string,
    learningActions: t.string,
    knowledgeRequirements: t.string,
    poapEventId: t.number,
    duration: t.number,
    learnings: t.string,
    difficulty: t.string,
    description: t.string,
    name: t.string,
    notionId: t.string,
    slug: t.string,
    slides: t.array(APISlide),
});

const APICourses = t.array(APICourse);

type APICourses = t.TypeOf<typeof APICourses>;

export class BanklessAcademyCourseLoader extends HTTPDataLoaderBase<
    APICourses,
    Course
> {
    public info = INFO;

    protected batchSize = BATCH_SIZE;
    protected type = Course;
    protected cadenceConfig = {
        [ScheduleMode.BACKFILL]: { seconds: 5 },
        [ScheduleMode.INCREMENTAL]: { minutes: 5 },
    };

    protected codec = APICourses;

    protected getUrlFor({ limit, cursor }: LoadContext) {
        return `https://bankless-academy-cg-lab.vercel.app/api/courses`;
    }

    protected mapResult(result: APICourses): Array<Course> {
        return result
            .map((course) => {
                const slides = course.slides.map((slide) => {
                    switch (slide.type) {
                        case "LEARN":
                            return {
                                type: slide.type,
                                title: slide.title,
                                content: slide.content,
                            };
                        case "QUIZ":
                            return {
                                type: slide.type,
                                title: slide.title,
                                quiz: {
                                    id: slide.quiz.id,
                                    rightAnswerNumber:
                                        slide.quiz.rightAnswerNumber,
                                    answers: [
                                        slide.quiz.answer_1,
                                        slide.quiz.answer_2,
                                        slide.quiz.answer_3,
                                        slide.quiz.answer_4,
                                    ].filter(notEmpty),
                                },
                            };
                        case "QUEST":
                            return {
                                type: slide.type,
                                title: slide.title,
                                component: slide.component,
                            };
                        case "POAP":
                            return {
                                type: slide.type,
                                title: slide.title,
                            };
                    }
                });
                try {
                    return {
                        id: course.notionId,
                        poapImageLink: course.poapImageLink,
                        learningActions: course.learningActions,
                        knowledgeRequirements: course.knowledgeRequirements,
                        poapEventId: course.poapEventId,
                        duration: course.duration,
                        learnings: course.learnings,
                        difficulty: course.difficulty,
                        description: course.description,
                        name: course.name,
                        notionId: course.notionId,
                        slug: course.slug,
                        slides: slides,
                    };
                } catch (e) {
                    this.logger.warn(`Processing Course failed`, e, course);
                    return undefined;
                }
            })
            .filter(notEmpty);
    }

    protected extractCursor(result: APICourses) {
        return `0`;
    }
}

export const createBanklessAcademyCourseLoader: () => BanklessAcademyCourseLoader =
    () => new BanklessAcademyCourseLoader();
