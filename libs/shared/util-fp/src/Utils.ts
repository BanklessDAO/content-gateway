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

type Falsy = undefined | false | 0 | "" | null | void;
type Unique = typeof Unique;
declare const Unique: unique symbol;
type Not<T extends boolean> = T extends true ? false : true;
type IsNever<T> = [T] extends [never] ? true : false;
type IsAny<T> = [T] extends [Unique] ? Not<IsNever<T>> : false;
type Or<T, U> = T extends Falsy ? U : T;
// eslint-disable-next-line @typescript-eslint/ban-types
type IsUnknown<T> = [T] extends [Unique | {} | void | null]
    ? false
    : true;

export type Required<T> = Or<IsAny<T>, IsUnknown<T>> extends true
    ? T
    : { [P in keyof T]-?: T[P] };
export type DeepRequired<T, E = readonly unknown[]> = Or<
    IsAny<T>,
    IsUnknown<T>
> extends true
    ? T
    : // eslint-disable-next-line @typescript-eslint/ban-types
    T extends E | Function
    ? T
    : { [P in keyof T]-?: DeepRequired<T[P], E> };
