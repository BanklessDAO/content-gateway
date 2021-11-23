import { AnyUser } from ".";

/**
 * A [[Context]] contains the necessary information for authorizing
 * an [[Operation]].
 *
 * @param user The user that is tyring to execute the operation.
 * @param data The input of the operation.
 */
export interface Context<I> {
    user: AnyUser;
    data: I;
}

export default Context;
