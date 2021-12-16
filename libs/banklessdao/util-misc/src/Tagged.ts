/**
 * Adds a __tag to a type. Use this for creating discriminated unions.
 */
export type Tagged<T extends string, U = unknown> = {
    readonly __tag: T;
} & U;

/**
 * Removes the __tag from a previously tagged object.
 */
export const untag = <T extends Tagged<string>>(t: T): Omit<T, "__tag"> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __tag, ...rest } = t;
    return rest;
};
