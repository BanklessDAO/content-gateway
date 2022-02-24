import { Operation } from "@shared/util-auth";
import * as TE from "fp-ts/TaskEither";
import { APIKeyDeletionError, ContentGatewayUser, UserRepository } from "..";

export const DELETE_API_KEY = "DELETE_API_KEY";

export type DeleteAPIKeyParams = {
    apiKeyId: string;
    owner: ContentGatewayUser;
};

export type DeleteAPIKey = Operation<DeleteAPIKeyParams, void>;

/**
 * Deletes the given API key from the given user.
 */
export const makeDeleteAPIKey = (
    userRepository: UserRepository
): DeleteAPIKey => ({
    name: DELETE_API_KEY,
    execute: ({ apiKeyId, owner: user }: DeleteAPIKeyParams) => {
        const index = user.apiKeys.findIndex(({ id }) => id === apiKeyId);
        if (index === -1) {
            return TE.left(new APIKeyDeletionError("API key not found"));
        }
        user.apiKeys.splice(index, 1);
        return TE.mapLeft(() => new APIKeyDeletionError("User update failed"))(
            userRepository.updateUser(user)
        );
    },
});
