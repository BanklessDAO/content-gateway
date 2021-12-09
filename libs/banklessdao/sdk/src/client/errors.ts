import { ProgramErrorBase } from "@shared/util-dto";
import { SchemaInfo, schemaInfoToString } from "@shared/util-schema";

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
