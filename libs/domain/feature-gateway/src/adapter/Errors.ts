import {
    SchemaInfo,
    schemaInfoToString,
    ValidationError,
} from "@shared/util-schema";

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

export class RegisteredSchemaIncompatibleError extends Error {
    public _tag = "RegisteredSchemaIncompatibleError";

    private constructor(info: SchemaInfo) {
        super(
            `There is an incompatible registered schema with key ${schemaInfoToString(
                info
            )}`
        );
    }

    public static create(info: SchemaInfo): RegisteredSchemaIncompatibleError {
        return new RegisteredSchemaIncompatibleError(info);
    }
}

export class SchemaCreationFailedError extends Error {
    public _tag = "SchemaCreationFailedError";

    private constructor(message: string) {
        super(message);
    }

    public static create(message: string): SchemaCreationFailedError {
        return new SchemaCreationFailedError(message);
    }
}

export class SchemaCursorUpdateFailedError extends Error {
    public _tag = "SchemaCursorUpdateFailedError";

    private constructor(message: string) {
        super(message);
    }

    public static create(message: string): SchemaCreationFailedError {
        return new SchemaCursorUpdateFailedError(message);
    }
}

export type SchemaRepositoryError =
    | RegisteredSchemaIncompatibleError
    | SchemaCreationFailedError
    | SchemaCursorUpdateFailedError;
