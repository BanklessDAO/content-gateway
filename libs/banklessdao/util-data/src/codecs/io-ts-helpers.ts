import * as t from "io-ts";

/** Helper for optional fields */
export const optional = <T extends t.Mixed>(x: T) => t.union([x, t.undefined]);