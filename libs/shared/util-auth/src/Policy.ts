import { ProgramError } from "@banklessdao/util-data";
import * as TE from "fp-ts/TaskEither";
import { Context } from "./Context";

/**
 * A [[Policy]] can be used to determine whether an operation can be executed
 * in the given [[context]].
 * If the operation is allowed it will return the context.
 * If not, it will return the appropriate error.
 */
export type Policy<I> = (
    context: Context<I>
) => TE.TaskEither<ProgramError, Context<I>>;
