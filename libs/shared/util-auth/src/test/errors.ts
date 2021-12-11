import { ProgramErrorBase } from "@shared/util-data";

export class TodoNotFoundError extends ProgramErrorBase<"TodoNotFoundError"> {
    constructor(id: number) {
        super({
            _tag: "TodoNotFoundError",
            message: `Todo with id ${id} not found`,
        });
    }
}

export class MissingPermissionError extends ProgramErrorBase<"MissingPermissionError"> {
    constructor() {
        super({
            _tag: "MissingPermissionError",
            message: `"The current user can't perform this operation."`,
        });
    }
}

