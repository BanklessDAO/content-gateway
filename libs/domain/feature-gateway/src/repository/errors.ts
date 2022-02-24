import { ProgramErrorBase } from "@banklessdao/util-data";
import {
    SchemaInfo,
    schemaInfoToString,
    ValidationError
} from "@banklessdao/util-schema";

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

export class SchemaNotFoundError extends ProgramErrorBase<"MissingSchemaError"> {
    public info: SchemaInfo;
    constructor(info: SchemaInfo) {
        super({
            _tag: "MissingSchemaError",
            message: `Schema ${schemaInfoToString(info)} not found`,
        });
        this.info = info;
    }
}

export class LoaderNotFoundError extends ProgramErrorBase<"MissingLoaderError"> {
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

export class UserCreationError extends ProgramErrorBase<"UserCreationError"> {
    constructor(message: string) {
        super({
            _tag: "UserCreationError",
            message: message,
        });
    }
}

export class UserUpdateError extends ProgramErrorBase<"UserUpdateError"> {
    constructor(message: string) {
        super({
            _tag: "UserUpdateError",
            message: message,
        });
    }
}

export class UserDeletionError extends ProgramErrorBase<"UserDeletionError"> {
    constructor(message: string) {
        super({
            _tag: "UserDeletionError",
            message: message,
        });
    }
}

export class UserNotFoundError extends ProgramErrorBase<"UserNotFoundError"> {
    constructor(message: string) {
        super({
            _tag: "UserNotFoundError",
            message: message,
        });
    }
}

export class InvalidAPIKeyError extends ProgramErrorBase<"InvalidAPIKeyError"> {
    constructor(message: string) {
        super({
            _tag: "InvalidAPIKeyError",
            message: message,
        });
    }
}

export class APIKeyCreationError extends ProgramErrorBase<"APIKeyCreationError"> {
    constructor(message: string) {
        super({
            _tag: "APIKeyCreationError",
            message: message,
        });
    }
}

export class APIKeyDeletionError extends ProgramErrorBase<"APIKeyDeletionError"> {
    constructor(message: string) {
        super({
            _tag: "APIKeyDeletionError",
            message: message,
        });
    }
}
