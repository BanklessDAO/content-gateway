import * as E from "fp-ts/Either";
import { programErrorCodec } from ".";

describe("Given an error object", () => {
    describe("without cause", () => {
        it("When decoding it Then it should decode properly", () => {
            const error = {
                _tag: "ProgramError",
                message: "An error occurred",
                details: {
                    becauseOf: "Something went wrong",
                },
            };

            const result = programErrorCodec.decode(error);

            expect(result).toEqual(E.right(error));
        });
    });

    describe("with cause", () => {
        it("When decoding it Then it should decode properly", () => {
            const cause = {
                _tag: "ProgramError",
                message: "Some other error occured",
                details: {},
            };

            const error = {
                _tag: "ProgramError",
                message: "An error occurred",
                details: {},
                cause: cause
            };

            const result = programErrorCodec.decode(error);

            expect(result).toEqual(E.right(error));
        });
    });
});
