import * as E from "fp-ts/Either";

export const extractUnsafe = <T>(either: E.Either<unknown, T>): T => {
    return (either as E.Right<T>).right;
};
