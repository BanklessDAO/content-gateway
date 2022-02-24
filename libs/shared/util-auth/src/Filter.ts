import { ProgramError } from "@banklessdao/util-data";
import * as TE from "fp-ts/TaskEither";
import { Context } from "./Context";

/**
 * A [[Filter]] can be used to alter the results of an operation after it
 * was executed.
 */
export type Filter<O> = (
    context: Context<O>
) => TE.TaskEither<ProgramError, Context<O>>;
