import { deserialize, serialize } from "@tsed/json-mapper";
import { Required } from "@tsed/schema";
import { SchemaInfoDTO } from ".";

export class SchemaDTO {
    @Required(true)
    key: SchemaInfoDTO;
    @Required(true)
    schema: string;

    constructor(key: SchemaInfoDTO, schema: string) {
        this.key = key;
        this.schema = schema;
    }

    static toJSON(dto: SchemaDTO): Record<string, unknown> {
        return serialize(dto);
    }

    static fromJSON(data: Record<string, unknown>): SchemaDTO {
        return deserialize(data, { type: SchemaDTO });
    }
}
