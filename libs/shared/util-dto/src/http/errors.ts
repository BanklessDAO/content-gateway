import { CodecValidationError, GenericProgramError, ProgramErrorBase } from "@shared/util-dto";
import { AxiosError } from "axios";

export class HTTPDataTransferError extends ProgramErrorBase<"HTTPDataTransferError"> {
    public error: AxiosError;
    constructor(error: AxiosError) {
        super({
            _tag: "HTTPDataTransferError",
            message: `HTTP data transfer failed.`,
            details: {
                status: error.response?.status,
                statusText: error.response?.statusText,
            },
        });
    }
}

export class GenericDataTransferError extends ProgramErrorBase<"GenericDataTransferError"> {
    public error: Error;
    constructor(error: Error) {
        super({
            _tag: "GenericDataTransferError",
            message: `Data transfer failed}`,
            details: {
                message: error.message,
                name: error.name,
            },
        });
    }
}

export class UnknownDataTransferError extends ProgramErrorBase<"UnknownDataTransferError"> {
    constructor() {
        super({
            _tag: "UnknownDataTransferError",
            message: `An unknown error happened during data transfer. This is probably a bug.`,
        });
    }
}

export type DataTransferError =
    | HTTPDataTransferError
    | CodecValidationError
    | GenericProgramError
    | GenericDataTransferError
    | UnknownDataTransferError;
