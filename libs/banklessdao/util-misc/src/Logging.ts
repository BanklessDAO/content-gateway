import { Logger } from "tslog";

/**
 * Creates a new tslog {@link Logger} object with the given `name`
 * which will log in a tasteful manner.
 */
export const createLogger = (name: string) =>
    new Logger({
        name: name,
        printLogMessageInNewLine: true,
        prefix: ["👉"],
    });
