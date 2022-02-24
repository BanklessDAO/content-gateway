import { Filter } from "./Filter";
import { Operation } from "./Operation";
import { Policy } from "./Policy";

/**
 * A [[Permission]] determines the constraints of executing an [[Operation]].
 *
 * @param name The name of the permission. This is useful when debugging.
 * @param policies are evaluated in order, and the [[operation]] is only allowed
 *   if a policy allows it.
 * @param filters are evaluated in order, and they may modify the result of
 *   the [[operation]].
 */
export interface Permission<I, O> {
    name: string;
    operationName: string;
    policies: Policy<I>[];
    filters?: Filter<O>[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPermission = Permission<any, any>;

/**
 * Creates a curried function that can be used to find the applicable
 * [[Permission]]s for a given [[operation]].
 */
export const getPermissionFilterFor =
    <I, O>(operation: Operation<I, O>) =>
    (permissions: AnyPermission[]): Permission<I, O>[] => {
        return permissions.filter(
            (permission) => permission.operationName === operation.name
        );
    };
