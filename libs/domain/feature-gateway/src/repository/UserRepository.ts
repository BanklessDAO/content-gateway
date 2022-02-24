/* eslint-disable @typescript-eslint/no-non-null-assertion */
import * as TE from "fp-ts/TaskEither";
import { v4 as uuid } from "uuid";
import {
    DatabaseError,
    UserCreationError,
    UserDeletionError,
    UserNotFoundError,
    UserUpdateError
} from ".";
import { ContentGatewayUser } from "./ContentGatewayUser";

export type UserRepository = {
    findById: (
        id: string
    ) => TE.TaskEither<UserNotFoundError | DatabaseError, ContentGatewayUser>;
    findByApiKeyId: (
        id: string
    ) => TE.TaskEither<UserNotFoundError | DatabaseError, ContentGatewayUser>;
    createUser: (
        name: string,
        roles: string[]
    ) => TE.TaskEither<UserCreationError, ContentGatewayUser>;
    updateUser: (
        user: ContentGatewayUser
    ) => TE.TaskEither<UserUpdateError, void>;
    deleteUser: (
        user: ContentGatewayUser
    ) => TE.TaskEither<UserDeletionError, void>;
};

export const createUserRepositoryStub = (
    users: Map<string, ContentGatewayUser> = new Map()
): UserRepository => {
    const findById = (
        id: string
    ): TE.TaskEither<UserNotFoundError | DatabaseError, ContentGatewayUser> => {
        if (users.has(id)) {
            return TE.right(users.get(id)!);
        } else {
            return TE.left(
                new UserNotFoundError("User not found for the given id")
            );
        }
    };

    const findByApiKeyId = (
        id: string
    ): TE.TaskEither<UserNotFoundError | DatabaseError, ContentGatewayUser> => {
        for (const user of users.values()) {
            if (user.apiKeys.find((key) => key.id === id)) {
                return TE.right(user);
            }
        }
        return TE.left(
            new UserNotFoundError("User not found for the given api key id")
        );
    };

    const createUser = (
        name: string,
        roles: string[]
    ): TE.TaskEither<UserCreationError, ContentGatewayUser> => {
        const id = uuid();
        const user = {
            id,
            name,
            roles,
            apiKeys: [],
        };
        users.set(id, user);
        return TE.right(user);
    };

    const updateUser = (
        user: ContentGatewayUser
    ): TE.TaskEither<UserUpdateError, void> => {
        if (users.has(user.id)) {
            users.set(user.id, user);
            return TE.right(undefined);
        } else {
            return TE.left(
                new UserUpdateError("Cannot update non-existing user")
            );
        }
    };

    const deleteUser = (
        user: ContentGatewayUser
    ): TE.TaskEither<UserDeletionError, void> => {
        if (users.has(user.id)) {
            users.delete(user.id);
            return TE.right(undefined);
        } else {
            return TE.left(
                new UserDeletionError("Cannot delete non-existing user")
            );
        }
    };

    return {
        findById,
        findByApiKeyId,
        createUser,
        updateUser,
        deleteUser,
    };
};
