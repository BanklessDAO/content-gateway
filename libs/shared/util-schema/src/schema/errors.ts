import { ProgramErrorBase } from "@shared/util-data";

export class SchemaValidationError extends ProgramErrorBase<"SchemaValidationError"> {
    constructor(errors: Record<string, unknown>) {
        super({
            _tag: "SchemaValidationError",
            message: `Schema validation failed`,
            details: errors,
        });
    }
}
