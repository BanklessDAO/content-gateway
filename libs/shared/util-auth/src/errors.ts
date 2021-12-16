import { ProgramErrorBase } from "@banklessdao/util-data";

export class AuthorizationError extends ProgramErrorBase<"AuthorizationError"> {
    constructor(message: string) {
        super({
            _tag: "AuthorizationError",
            message: message,
        });
    }
}

