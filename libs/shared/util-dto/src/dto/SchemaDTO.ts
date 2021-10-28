import { Schema } from "@shared/util-schema";
import { deserialize, serialize } from "@tsed/json-mapper";
import { Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
import { SchemaInfoDTO } from ".";

export class SchemaDTO {
    @Required(true)
    info: SchemaInfoDTO;
    @Required(true)
    schema: Record<string, unknown>;

    constructor(info: SchemaInfoDTO, schema: Record<string, unknown>) {
        this.info = info;
        this.schema = schema;
    }

    static toJSON(dto: SchemaDTO): Record<string, unknown> {
        return serialize(dto);
    }

    static fromJSON(data: Record<string, unknown>): E.Either<Error, SchemaDTO> {
        return E.tryCatch(() => deserialize(data, SchemaDTO), E.toError);
    }

    static fromSchema(schema: Schema): SchemaDTO {
        return new SchemaDTO(
            SchemaInfoDTO.fromSchemaInfo(schema.info),
            schema.schemaObject
        );
    }
}
