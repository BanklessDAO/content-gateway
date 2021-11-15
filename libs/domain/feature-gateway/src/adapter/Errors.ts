import { SchemaInfo, schemaInfoToString, ValidationError } from "@shared/util-schema";

export class DataValidationError extends Error {
    public _tag = "DataValidationError";
    public errors: ValidationError[];

    constructor(errors: ValidationError[]) {
        super(
            "Validation failed: " +
                errors.map((it) => `${it.message}: ${it.message}`).join("\n")
        );
        this.errors = errors;
    }
}

export class DatabaseStorageError extends Error {
    public _tag = "DatabaseError";
    public cause: Error;

    constructor(cause: Error) {
        super(`Failed to store data: ${cause.message}`);
        this.cause = cause;
    }
}

export class MissingSchemaError extends Error {
    public _tag = "MissingSchemaError";
    public info: SchemaInfo;

    constructor(info: SchemaInfo) {
        super(`No schema found by info: ${schemaInfoToString(info)}`);
        this.info = info;
    }
}

export type StorageError =
    | DataValidationError
    | DatabaseStorageError
    | MissingSchemaError;
