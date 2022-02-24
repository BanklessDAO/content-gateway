import { Operation } from "@shared/util-auth";
import { ContentGatewayUser, UserRepository } from "..";

export const DELETE_USER = "DELETE_USER";

export type DeleteUserParams = {
    user: ContentGatewayUser;
};

export type DeleteUser = Operation<DeleteUserParams, void>;

/**
 * Deletes a User.
 */
export const makeDeleteUser = (userRepository: UserRepository): DeleteUser => ({
    name: DELETE_USER,
    execute: ({ user }: DeleteUserParams) => userRepository.deleteUser(user),
});
