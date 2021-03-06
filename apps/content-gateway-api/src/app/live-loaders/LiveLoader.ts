import { GraphQLFieldConfigMap } from "graphql";
import * as TE from "fp-ts/TaskEither";
import { ProgramError } from "@banklessdao/util-data";

export type LiveLoader<I, O> = {
    configure: () => GraphQLFieldConfigMap<string, unknown>
    load: (params: I) => TE.TaskEither<ProgramError, O>
}
