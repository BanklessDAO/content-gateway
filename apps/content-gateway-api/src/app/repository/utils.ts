import { DatabaseError } from "@domain/feature-gateway";
import { UnknownError } from "@banklessdao/util-data";
import * as TE from "fp-ts/TaskEither";

export const wrapDbOperation =
    <R>(op: () => Promise<R>) =>
    () => {
        return TE.tryCatch(
            () => op(),
            (e: unknown) => {
                return new DatabaseError(
                    e instanceof Error ? e : new UnknownError(e)
                );
            }
        );
    };

export const wrapDbOperationWithParams =
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
