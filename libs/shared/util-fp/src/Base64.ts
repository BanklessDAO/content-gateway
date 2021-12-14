/**
 * Encodes an utf-8 string to a base64 string.
 */
export const base64Encode = (str: string): string => {
    return Buffer.from(str, "utf-8").toString("base64");
};

/**
 * Decodes a base64 string to an utf-8 string.
 */
export const base64Decode = (str: string): string => {
    return Buffer.from(str, "base64").toString("utf8");
};
