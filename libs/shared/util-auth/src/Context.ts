import { AnyUser } from ".";

/**
 * A [[Context]] contains the necessary information for authorizing
 * an [[Operation]].
 *
 * @param user The user that is trying to execute the operation.
 * @param data The input/output of the operation.
 */
export interface Context<I> {
    currentUser: AnyUser;
    data: I;
}
