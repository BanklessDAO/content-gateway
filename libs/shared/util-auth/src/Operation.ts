import { ProgramError } from "@banklessdao/util-data";
import * as TE from "fp-ts/lib/TaskEither";

/**
 * Represents an asynchronous operation that takes an arbitrary `input` and returns
 * a wrapped result, that's either a success or a failure. Failure is represented by a
 * [[ProgramError]] object, success is represented by an arbitrary object
 * of type `O`.
 */
export type Operation<I, O> = {
    name: string;
    execute: (input: I) => TE.TaskEither<ProgramError, O>;
};
