import { DatabaseError, UnknownError } from "@domain/feature-gateway";
import * as TE from "fp-ts/TaskEither";

export const wrapPrismaOperation =
    <T, R>(op: (params: T) => Promise<R>) =>
    (params: T) => {
        return TE.tryCatch(
            () => op(params),
            (e: unknown) => {
                return new DatabaseError(
                    e instanceof Error ? e : new UnknownError(e)
                );
            }
        );
    };
