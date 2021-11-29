import { notEmpty } from "@shared/util-fp";
import { LoadContext, ScheduleMode } from "@shared/util-loaders";
import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";
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
    @Required(true)
    @CollectionOf(String)
    answers: string[];
    @Required(true)
    rightAnswerNumber: number;
    @Required(true)
    id: string;
}

class Slide {
    @Required(true)
    type: string;
    @Required(true)
    title: string;
    @Required(false)
    content?: string;
    @Required(false)
    quiz?: Quiz;
    @Required(false)
    component?: string;
}

@AdditionalProperties(false)
class Course {
    @Required(true)
    id: string;
    @Required(true)
    poapImageLink: string;
    @Required(true)
    learningActions: string;
    @Required(true)
    knowledgeRequirements: string;
    @Required(true)
    poapEventId: number;
    @Required(true)
    duration: number;
    @Required(true)
    learnings: string;
    @Required(true)
    difficulty: string;
    @Required(true)
    description: string;
    @Required(true)
    name: string;
    @Required(true)
    notionId: string;
    @Required(true)
    slug: string;
    @CollectionOf(Slide)
    @Required(true)
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

export class CourseLoader extends HTTPDataLoaderBase<APICourses, Course> {
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
                        slides: [],
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

export const createCourseLoader: () => CourseLoader = () => new CourseLoader();
