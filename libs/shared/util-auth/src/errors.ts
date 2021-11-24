import { ProgramErrorBase } from "@shared/util-dto";

export class AuthorizationError extends ProgramErrorBase<"AuthorizationError"> {
    constructor(message: string) {
        super({
            _tag: "AuthorizationError",
            message: message,
        });
    }
}

