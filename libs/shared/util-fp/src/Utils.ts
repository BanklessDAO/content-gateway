import * as E from "fp-ts/Either";
import { Logger } from "tslog";

const logger = new Logger({
    name: "shared-util-fp-Utils",
});

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
