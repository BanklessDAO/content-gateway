import { ProgramErrorBase } from "@banklessdao/util-data";
import { SchemaInfo, schemaInfoToString } from "@banklessdao/util-schema";

export class SchemaNotFoundError extends ProgramErrorBase<"SchemaNotFoundError"> {
    public info: SchemaInfo;
    constructor(info: SchemaInfo) {
        super({
            _tag: "SchemaNotFoundError",
            message: `No schema found for key ${schemaInfoToString(info)}`,
        });
        this.info = info;
    }
}
