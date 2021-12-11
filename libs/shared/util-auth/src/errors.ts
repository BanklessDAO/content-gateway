import { ProgramErrorBase } from "@shared/util-data";

export class AuthorizationError extends ProgramErrorBase<"AuthorizationError"> {
    constructor(message: string) {
        super({
            _tag: "AuthorizationError",
            message: message,
        });
    }
}

