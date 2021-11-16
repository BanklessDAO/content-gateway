import { AdditionalProperties, CollectionOf, Required } from "@tsed/schema";

export const courseInfo = {
    namespace: "bankless-academy",
    name: "Course",
    version: "V1",
};

export class Quiz {
    @Required(true)
    @CollectionOf(String)
    answers: string[];
    @Required(true)
    rightAnswerNumber: number;
}

export class Section {
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
export class Course {
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
