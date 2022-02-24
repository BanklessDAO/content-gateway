import { Operation } from "@shared/util-auth";
import * as t from "io-ts";
import { withMessage } from "io-ts-types";
import { UserRepository } from "..";
import { ContentGatewayUser } from "../repository/ContentGatewayUser";

export const CreateUserParamsCodec = t.strict({
    name: withMessage(t.string, () => "name must be a string"),
    roles: withMessage(
        t.array(t.string),
        () => "roles must be an array of strings"
    ),
});

export type CreateUserParams = t.TypeOf<typeof CreateUserParamsCodec>;

export type CreateUser = Operation<CreateUserParams, ContentGatewayUser>;

export const CREATE_USER = "CREATE_USER";

/**
 * Creates a new User.
 */
export const makeCreateUser = (userRepository: UserRepository): CreateUser => ({
    name: CREATE_USER,
    execute: ({ name, roles }: CreateUserParams) =>
        userRepository.createUser(name, roles),
});
