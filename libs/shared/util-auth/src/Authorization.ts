import { ProgramError } from "@shared/util-dto";
import * as A from "fp-ts/Array";
import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { AnyUser } from ".";
import Context from "./Context";
import { AuthorizationError } from "./errors";
import { Filter } from "./Filter";
import { Operation } from "./Operation";
import { getPermissionFilterFor } from "./Permission";
import { Policy } from "./Policy";
import { Role } from "./Role";

/**
 * Contains authorization information for a set of [[Role]]s.
 */
export interface Authorization {
    roles: {
        [key: string]: Role;
    };
}

/**
 * This brand makes it sure that [[AuthorizedOperation]]s can only be creted
 * by [[authorize]].
 */
export interface AuthorizedOperationBrand {
    readonly _: unique symbol;
}

/**
 * An [[AuthorizedOperation]] is a [[Operation]] that has been authorized
 * with an [[Authorization]] object. It is safe to call from a security
 * perspective with any [[Context]] object.
 *
 * Note that while [[Operation]]s are designed for ease of implementation,
 * [[AuthorizedOperation]]s are designed to be used in a more functional
 * way (eg: with [[pipe]]).
 *
 * Usage:
 *
 * ```ts
 * const result = pipe(
 *   E.right<Error, Context<number>>(context),
 *   authorizedFind,
 *   authorizedDelete,
 * )
 * ```
 */
export type AuthorizedOperation<I, O> = (
    input: TE.TaskEither<ProgramError, Context<I>>
) => TE.TaskEither<ProgramError, Context<O>> & AuthorizedOperationBrand;

/**
 * Takes an [[Operation]] and augments it with authorization information.
 */
export const authorize = <I, O>(
    operation: Operation<I, O>,
    authorization: Authorization
): AuthorizedOperation<I, O> => {
    return ((input: TE.TaskEither<ProgramError, Context<I>>) => {
        return pipe(
            input,
            TE.chainW((context: Context<I>) => {
                const { user } = context;
                const roles = authorization.roles;

                const permissions = pipe(
                    Object.keys(roles),
                    A.filter((role) => user.roles.includes(role)),
                    A.chain((role) => roles[role].permissions),
                    getPermissionFilterFor(operation)
                );

                const policies = pipe(
                    permissions,
                    A.chain((permission) => permission.policies)
                );

                const filters = pipe(
                    permissions,
                    A.chain((permission) => permission.filters || [])
                );

                if (policies.length === 0) {
                    return TE.left(
                        new AuthorizationError(
                            `Current user ${user.name} has no permission to perform ${operation.name}`
                        ) as ProgramError
                    );
                }

                const result = pipe(
                    policies,
                    evaluatePolicies(context),
                    executeOperation(operation, user)
                );

                return applyFilters(filters, result);
            })
        );
    }) as AuthorizedOperation<I, O>;
};

const evaluatePolicies = <I>(context: Context<I>) =>
    A.reduce<Policy<I>, TE.TaskEither<ProgramError, Context<I>>>(
        TE.right(context),
        (acc, policy) => pipe(acc, TE.chain(policy))
    );

const executeOperation = <I, O>(operation: Operation<I, O>, user: AnyUser) =>
    TE.chain((c: Context<I>) =>
        pipe(
            c.data,
            operation,
            TE.map((output: O) => {
                return {
                    user: user,
                    data: output,
                };
            })
        )
    );

const applyFilters = <O>(
    filters: Filter<O>[],
    result: TE.TaskEither<ProgramError, Context<O>>
) =>
    pipe(
        filters,
        A.reduce<Filter<O>, TE.TaskEither<ProgramError, Context<O>>>(
            result,
            (acc, filter) => pipe(acc, TE.chain(filter))
        )
    );
