import { SchemaInfo } from "@shared/util-schema";

// TODO: nuke this as we have PayloadJson
export type Data = {
    info: SchemaInfo;
    data: Record<string, unknown>;
};
