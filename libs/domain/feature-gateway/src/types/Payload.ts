import { SchemaInfo } from "@shared/util-schema";

export type Payload<T> = {
    key: SchemaInfo;
    data: T;
};
