import { TypeKey } from "@shared/util-schema";
import { ValidateFunction } from "ajv";

/**
 * Represents a snapshot of a schema at a given point in time.
 * A schema can change over time, but a snapshot is immutable.
 */
export type SchemaSnapshot<T> = {
    key: TypeKey<T>;
    // ❗ we'll make this framework-agnostic later
    schema: ValidateFunction<T>;
};
