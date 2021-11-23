import { ProgramErrorBase } from "@shared/util-dto";
import {
    SchemaInfo,
    schemaInfoToString,
    ValidationError
} from "@shared/util-schema";

export class SchemaValidationError extends ProgramErrorBase<"SchemaValidationError"> {
    constructor(errors: ValidationError[]) {
        super({
            _tag: "SchemaValidationError",
            message: "Schema validation for payload failed",
            details: errors.reduce((acc, curr) => {
                acc[curr.field] = curr.message;
                return acc;
            }, {} as Record<string, unknown>),
        });
    }
}

export class DatabaseError extends ProgramErrorBase<"DatabaseError"> {
    public error: Error | undefined;
    constructor(cause: Error | undefined) {
        super({
            _tag: "DatabaseError",
            message: cause?.message ?? "Database operation failed",
        });
    }
}

export class UnknownError extends ProgramErrorBase<"UnknownError"> {
    public unknownCause: unknown;
    constructor(unknownCause: unknown) {
        super({
            _tag: "UnknownError",
            message: "Some unknown error happened. This is probably a bug.",
            details:
                unknownCause instanceof Error
                    ? {
                          name: unknownCause.name,
                          message: unknownCause.message,
                      }
                    : {},
        });
        this.unknownCause = unknownCause;
    }
}

export class MissingSchemaError extends ProgramErrorBase<"MissingSchemaError"> {
    public info: SchemaInfo;
    constructor(info: SchemaInfo) {
        super({
            _tag: "MissingSchemaError",
            message: `Schema ${schemaInfoToString(info)} not found`,
        });
        this.info = info;
    }
}

export class MissingLoaderError extends ProgramErrorBase<"MissingLoaderError"> {
    public info: SchemaInfo;
    constructor(info: SchemaInfo) {
        super({
            _tag: "MissingLoaderError",
            message: `Loader for ${schemaInfoToString(info)} not found`,
        });
        this.info = info;
    }
}

export class RegisteredSchemaIncompatibleError extends ProgramErrorBase<"RegisteredSchemaIncompatibleError"> {
    public info: SchemaInfo;
    constructor(info: SchemaInfo) {
        super({
            _tag: "RegisteredSchemaIncompatibleError",
            message: `There is an incompatible registered schema with key ${schemaInfoToString(
                info
            )}`,
        });
        this.info = info;
    }
}

export class SchemaCreationFailedError extends ProgramErrorBase<"SchemaCreationFailedError"> {
    constructor(message: string) {
        super({
            _tag: "SchemaCreationFailedError",
            message: message,
        });
    }
}
