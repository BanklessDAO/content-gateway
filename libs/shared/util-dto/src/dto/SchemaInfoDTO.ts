import { deserialize, serialize } from "@tsed/json-mapper";
import { Required } from "@tsed/schema";

export class SchemaInfoDTO {
    @Required(true)
    namespace: string;
    @Required(true)
    name: string;
    @Required(true)
    version: string;

    constructor(namespace: string, name: string, version: string) {
        this.namespace = namespace;
        this.name = name;
        this.version = version;
    }

    static toJSON(dto: SchemaInfoDTO): Record<string, unknown> {
        return serialize(dto);
    }

    static fromJSON(data: Record<string, unknown>): SchemaInfoDTO {
        return deserialize(data, { type: SchemaInfoDTO });
    }
}
