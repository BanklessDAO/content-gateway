import { SchemaInfo } from "@shared/util-schema";

export type Data = {
    info: SchemaInfo;
    data: Record<string, unknown>;
};
