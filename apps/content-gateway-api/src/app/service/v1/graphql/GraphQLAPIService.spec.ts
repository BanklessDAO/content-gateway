import * as pluralize from "pluralize";
import { pascalCase } from "pascal-case";

describe("Given pluralize", () => {
    it("Pluralize", () => {
        console.log(pluralize.plural("CourseLibrary"));
    });

    it("Pascal case", () => {
        console.log(pascalCase("hello-world"));
    });
});
