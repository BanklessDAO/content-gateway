/**
 * Isomorphic serialization utility that can convert
 * from JSON string -> JSON object and vice versa.
 */
export interface JSONSerializer {
    /**
     * Converts the given JSON object to a JSON string.
     */
    serialize(value: Record<string, unknown>): string;
    /**
     * Converts the given JSON string to a JSON object.
     */
    deserialize(value: string): Record<string, unknown>;
}

export const createDefaultJSONSerializer = (): JSONSerializer => {
    return {
        serialize: (value: Record<string, unknown>): string => {
            return JSON.stringify(value);
        },
        deserialize: (value: string): Record<string, unknown> => {
            return JSON.parse(value);
        },
    };
};
