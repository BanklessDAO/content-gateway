import { assert } from "console";

/**
 * Type guard for a value `T` that will only allow non-empty (non-null and non-undefined) values.
 */
export function notEmpty<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}

/**
 * Creates a new `Error` with the given `msg`.
 */
export const programError = (msg: string): never => {
    throw new Error(msg);
};

/**
 * Tries to convert a `string` to a primitive value (`string`, `number`, `boolean`).
 */
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

/**
 * A function for retrieving a necessary environment variable 
 * @param vName the name of the environment variable
 * @returns the environment variable
 */
export const verifiedEnvVar = (vName:string):string => {
    assert(process.env[vName] !== undefined, `Define the environment variable: ${vName}`)
    return process.env[vName] as string
}
