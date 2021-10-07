import { JSONSerializer, Schema } from "@shared/util-schema";
import { deserialize, serialize } from "@tsed/json-mapper";
import { Required } from "@tsed/schema";
import { SchemaInfoDTO } from ".";

export class SchemaDTO {
    @Required(true)
    info: SchemaInfoDTO;
    @Required(true)
    schema: string;

    constructor(info: SchemaInfoDTO, schema: string) {
        this.info = info;
        this.schema = schema;
    }

    static toJSON(dto: SchemaDTO): Record<string, unknown> {
        return serialize(dto);
    }

    static fromJSON(data: Record<string, unknown>): SchemaDTO {
        return deserialize(data, { type: SchemaDTO });
    }

    static fromSchema(schema: Schema): SchemaDTO {
        return new SchemaDTO(
            SchemaInfoDTO.fromSchemaInfo(schema.info),
            schema.toJSONString()
        );
    }
}

export const schemaToString: (
    serializer: JSONSerializer
) => (schema: Schema) => string = (serializer) => (schema) => {
    return serializer.serialize(SchemaDTO.toJSON(SchemaDTO.fromSchema(schema)));
};

export const stringToSchemaDTO: (
    serializer: JSONSerializer
) => (schema: string) => SchemaDTO = (serializer) => (schema) => {
    return SchemaDTO.fromJSON(serializer.deserialize(schema));
};
