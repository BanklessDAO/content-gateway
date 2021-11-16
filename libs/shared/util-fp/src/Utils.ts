import * as E from "fp-ts/Either";


export const extractRight = <T>(either: E.Either<unknown, T>): T => {
    if (E.isLeft(either)) {
        throw new Error("The supplied either was a Left");
    } else {
        return either.right;
    }
};

export const extractLeft = <E>(either: E.Either<E, unknown>): E => {
    if (E.isLeft(either)) {
        return either.left;
    } else {
        throw new Error("The supplied either was a Right");
    }
};

export function notEmpty<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}
