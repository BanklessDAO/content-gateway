import { UnknownError } from "@banklessdao/util-data";
import { base64Encode, createLogger } from "@banklessdao/util-misc";
import { Operation } from "@shared/util-auth";
import * as bcrypt from "bcrypt";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { v4 as uuid } from "uuid";
import {
    APIKey,
    APIKeyCreationError,
    ContentGatewayUser,
    UserRepository
} from "..";

const logger = createLogger("Create API key");

export const CREATE_API_KEY = "CREATE_API_KEY";

export type CreateAPIKeyParams = {
    owner: ContentGatewayUser;
};

export type CreateAPIKey = Operation<CreateAPIKeyParams, APIKey>;

/**
 * Creates a new API key for the given user.
 */
export const makeCreateAPIKey = (
    userRepository: UserRepository
): CreateAPIKey => ({
    name: CREATE_API_KEY,
    execute: ({ owner }: CreateAPIKeyParams) => {
        return pipe(
            TE.Do,
            TE.bind("user", () => TE.of(owner)),
            TE.bind("key", () => {
                return TE.tryCatch(
                    async () => {
                        return {
                            id: uuid(),
                            secret: uuid(),
                        };
                    },
                    (e) => new UnknownError(e)
                );
            }),
            TE.bindW("hash", ({ key }) => {
                return TE.tryCatch(
                    () => bcrypt.hash(key.secret, 10),
                    (e) => {
                        logger.error("Failed to hash API key", e);
                        return new APIKeyCreationError(
                            "Could not create API key: processing secret failed."
                        );
                    }
                );
            }),
            TE.chainFirstW(({ user, key, hash }) => {
                user.apiKeys.push({
                    id: key.id,
                    hash: hash,
                });
                return userRepository.updateUser(user);
            }),
            TE.map(({ key }) => {
                return key;
            })
        );
    },
});
