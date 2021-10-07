import { deserialize, serialize } from "@tsed/json-mapper";
import { Required } from "@tsed/schema";
import { SchemaInfoDTO } from ".";

export class PayloadDTO<T> {
    @Required(true)
    info: SchemaInfoDTO;
    @Required(true)
    data: T;

    constructor(info: SchemaInfoDTO, data: T) {
        this.info = info;
        this.data = data;
    }

    static toJSON<T>(dto: PayloadDTO<T>): Record<string, unknown> {
        return serialize(dto);
    }

    static fromJSON<T>(data: Record<string, unknown>): PayloadDTO<T> {
        return deserialize(data, { type: PayloadDTO });
    }
}
