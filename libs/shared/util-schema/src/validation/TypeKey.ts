/**
 * Represents a unique identifier for a data type.
 */
export type TypeKey<T> = {
    namespace: string;
    name: string;
    version: string;
};

export const keyToString = <T>(key: TypeKey<T>): string =>
    `${key.namespace}.${key.name}.${key.version}`;
