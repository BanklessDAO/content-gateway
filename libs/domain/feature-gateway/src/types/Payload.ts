import { TypeKey } from "@shared/util-schema";

export type Payload<T> = {
    key: TypeKey<T>;
    data: T;
};
