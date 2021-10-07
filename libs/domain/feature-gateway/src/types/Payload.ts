import { SchemaInfo } from "@shared/util-schema";

export type Payload<T> = {
    info: SchemaInfo;
    data: T;
};
