import * as TO from "fp-ts/TaskOption";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";

describe("A Task option", () => {
    it("When none is converted to task either Then it is error", async () => {
        const none: TO.TaskOption<string> = TO.none;

        const result = await pipe(
            none,
            TE.fromTaskOption(() => new Error("missing"))
        )();

        expect(result).toEqual(E.left(new Error("missing")));
    });

    it("When some is converted to task either Then it is value", async () => {
        const none: TO.TaskOption<string> = TO.some("hey");

        const result = await pipe(
            none,
            TE.fromTaskOption(() => new Error("missing"))
        )();

        expect(result).toEqual(E.right("hey"));
    });
});
