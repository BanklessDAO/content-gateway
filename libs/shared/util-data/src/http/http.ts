import axios from "axios";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import * as t from "io-ts";
import {
    CodecValidationError,
    GenericProgramError,
    programErrorCodec
} from "..";
import {
    DataTransferError,
    GenericDataTransferError,
    HTTPDataTransferError,
    UnknownDataTransferError
} from "./errors";

const handleError = (error: unknown): DataTransferError => {
    if (axios.isAxiosError(error)) {
        const result = programErrorCodec.decode(error.response?.data);
        if (E.isRight(result)) {
            const programError = result.right;
            programError.details = {
                ...programError.details,
                status: error.response?.status,
                statusText: error.response?.statusText,
            };
            return new GenericProgramError(programError);
        } else {
            return new HTTPDataTransferError(error);
        }
    } else {
        // TODO: this won't happen probably, but who knows...
        if (error instanceof Error) {
            return new GenericDataTransferError(error);
        } else {
            return new UnknownDataTransferError();
        }
    }
};

const decodeResponse = <T>(codec: t.Type<T>) => {
    return TE.chainW((data: unknown) => {
        return TE.fromEither(
            pipe(
                codec.decode(data),
                E.mapLeft((e: t.Errors) => {
                    return new CodecValidationError(
                        `Decoding HTTP response failed.`,
                        e
                    );
                })
            )
        );
    });
};

export type GetParams<T> = {
    url: string;
    codec: t.Type<T>;
};

export type PostParams<T> = {
    url: string;
    input: Record<string, unknown>;
    codec: t.Type<T>;
};

/**
 * Executes a GET request and returns the result.
 */
export const get = <T>({
    url,
    codec,
}: GetParams<T>): TE.TaskEither<DataTransferError, T> => {
    return pipe(
        TE.tryCatch(
            async () => {
                const { data } = await axios.get(url);
                return data as unknown;
            },
            (error: unknown) => {
                return handleError(error);
            }
        ),
        decodeResponse(codec)
    );
};

/**
 * Executes a POST request and returns the result.
 */
export const post = <T>({
    url,
    input,
    codec,
}: PostParams<T>): TE.TaskEither<DataTransferError, T> => {
    return pipe(
        TE.tryCatch(
            async () => {
                const { data } = await axios.post(url, input);
                return data as unknown;
            },
            (error: unknown) => {
                return handleError(error);
            }
        ),
        decodeResponse(codec)
    );
};
