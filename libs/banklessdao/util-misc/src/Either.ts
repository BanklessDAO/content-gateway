import * as E from "fp-ts/Either";

/**
 * Tries to extract a Right value from an Either or throws an exception.
 * Useful for testing.
 */
export const extractRight = <T>(either: E.Either<unknown, T>): T => {
    if (E.isLeft(either)) {
        throw new Error("The supplied either was a Left");
    } else {
        return either.right;
    }
};

/**
 * Tries to extract a Left value from an Either or throws an exception.
 * Useful for testing.
 */
export const extractLeft = <E>(either: E.Either<E, unknown>): E => {
    if (E.isLeft(either)) {
        return either.left;
    } else {
        throw new Error("The supplied either was a Right");
    }
};
