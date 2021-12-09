import { ClassType } from ".";
import { createRefConnector } from "./utils";

export type RefParams = {
    type: ClassType;
};

export type ArrayRefParams = RefParams;

/**
 * Connects a class {@link Property} in your schema to another
 * {@link Type}. Use this for **array** references.
 */
export const ArrayRef = (params: ArrayRefParams) => {
    return createRefConnector("array", params.type);
};

/**
 * Connects a class {@link Property} in your schema to another
 * {@link Type}. Use this for plain **object** references.
 */
export const ObjectRef = (params: RefParams) => {
    return createRefConnector("object", params.type);
};
