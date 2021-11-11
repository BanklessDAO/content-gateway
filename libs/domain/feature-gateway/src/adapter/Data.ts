import { SchemaInfo } from "@shared/util-schema";

export type Data = {
    id?: bigint;
    info: SchemaInfo;
    data: Record<string, unknown>;
};
