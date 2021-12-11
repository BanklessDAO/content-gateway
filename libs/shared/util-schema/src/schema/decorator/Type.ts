/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-types */
import "reflect-metadata";
import { setTypeNameFor } from "./utils";

/**
 * Use the {@link Nested} decorator on all your classes that
 * you intend to nest into your schema class.
 */
export const Nested = (_: {} = {}) => {
    return (target: Function) => {
        setTypeNameFor(target);
    };
};
