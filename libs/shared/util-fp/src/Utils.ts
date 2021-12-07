import * as E from "fp-ts/Either";
import { Logger } from "tslog";

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

export const createLogger = (name: string) =>
    new Logger({
        name: name,
        printLogMessageInNewLine: true,
        prefix: ["👉"],
        // displayFilePath: "hidden",
    });

export const programError = (msg: string): never => {
    throw new Error(msg);
};

export const coercePrimitive = (value: string): string | number | boolean => {
    if (value === "true") {
        return true;
    }
    if (value === "false") {
        return false;
    }

    const int = parseInt(value);

    if (!isNaN(int)) {
        return int;
    }

    const float = parseFloat(value);

    if (!isNaN(float)) {
        return float;
    }

    return value;
};
