import * as TO from "fp-ts/TaskOption";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";

describe("Playground", () => {
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

    describe("A promise", () => {

        const fun = async () => {
            return "works";
        };
        it("works async", async () => {
            const promise: Promise<string> = fun();
            const result = await promise;
        });

        it("works then", async () => {
            const handle = (): string => {
                const promise: Promise<string> = fun();
                promise.then(result => {
                    return result;
                });
                return "doesn't work"
            }
        });
    });
});
