import { ProgramError } from "@shared/util-data";
import * as TE from "fp-ts/lib/TaskEither";

export type Operation<I, O> = (input: I) => TE.TaskEither<ProgramError, O>;

