import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
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
                    : {
                          unknownCause: String(unknownCause),
                      },
        });
        this.unknownCause = unknownCause;
    }
}

export class CodecValidationError extends ProgramErrorBase<"CodecValidationError"> {
    constructor(message: string, e: t.Errors) {
        super({
            _tag: "CodecValidationError",
            message: message,
            details: {
                errorReport: e.map(
                    (item) => item.message ?? "Value was invalid"
                ),
            },
        });
    }

    static fromMessage(message: string): CodecValidationError {
        return new CodecValidationError(message, []);
    }
}

export const mapCodecValidationError: <T>(
    message: string
) => (fa: E.Either<t.Errors, T>) => E.Either<CodecValidationError, T> = (
    message
) => E.mapLeft((error: t.Errors) => new CodecValidationError(message, error));
