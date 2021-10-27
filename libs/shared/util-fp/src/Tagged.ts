export type Tagged<T extends string, U = unknown> = {
    readonly __tag: T;
} & U;

export const untag = <T extends Tagged<string>>(
    t: T
): Omit<T, "__tag"> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { __tag, ...rest } = t;

    return rest;
};

export const tagged = <A extends string>(tag: A) => ({ __tag: tag } as const);
