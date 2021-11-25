import * as E from "fp-ts/Either";
import * as t from "io-ts";

export interface ProgramError {
    _tag: string;
    message: string;
    details: Record<string, unknown>;
    cause?: ProgramError;
}

export const programErrorCodec: t.Type<ProgramError> = t.recursion(
    "ProgramError",
    () =>
        t.intersection([
            t.strict({
                _tag: t.string,
                message: t.string,
                details: t.record(t.string, t.unknown),
            }),
            t.partial({
                cause: programErrorCodec,
            }),
        ])
);

export abstract class ProgramErrorBase<T extends string>
    extends Error
    implements ProgramError
{
    public _tag: T;
    public message: string;
    public details: Record<string, unknown>;
    public cause: ProgramError | undefined;

    constructor(params: {
        _tag: T;
        message: string;
        details?: Record<string, unknown>;
        cause?: ProgramError;
    }) {
        super(params.message);
        this._tag = params._tag;
        this.message = params.message;
        this.details = params.details ?? {};
        this.cause = params.cause;
    }
}

export class GenericProgramError extends ProgramErrorBase<string> {
    constructor(e: ProgramError) {
        super(e);
    }
}
export class UnknownError extends ProgramErrorBase<"UnknownError"> {
    private e: unknown;
    constructor(e: unknown) {
        super({
            _tag: "UnknownError",
            message:
                e instanceof Error
                    ? e.message
                    : `An unknown error happened: ${e}`,
        });
        this.e = e;
    }
}

export class CodecValidationError extends ProgramErrorBase<"CodecValidationError"> {
    constructor(message: string, e: t.Errors) {
        super({
            _tag: "CodecValidationError",
            message: message,
            details: {
                errorReport: e.map(
                    (item) => `${item.value} was invalid: ${item.message}`
                ),
            },
        });
    }
}

export const mapCodecValidationError: <T>(
    message: string
) => (fa: E.Either<t.Errors, T>) => E.Either<CodecValidationError, T> = (
    message
) => E.mapLeft((error: t.Errors) => new CodecValidationError(message, error));