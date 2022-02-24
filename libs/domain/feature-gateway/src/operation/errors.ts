import { ProgramError, ProgramErrorBase } from "@banklessdao/util-data";

export class DataReceivingError extends ProgramErrorBase<"DataReceivingError"> {
    constructor(cause: ProgramError) {
        super({
            _tag: "DataReceivingError",
            message: "Receiving data failed",
            cause: cause,
        });
    }
}

export class BatchDataReceivingError extends ProgramErrorBase<"BatchDataReceivingError"> {
    constructor(cause: ProgramError) {
        super({
            _tag: "BatchDataReceivingError",
            message: "Receiving batch data failed",
            cause: cause,
        });
    }
}
