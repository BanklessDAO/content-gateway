import { Payload } from "@domain/feature-gateway";
import { JSONSerializer } from "@shared/util-schema";
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

    static fromPayload<T>(payload: Payload<T>): PayloadDTO<T> {
        return new PayloadDTO(
            SchemaInfoDTO.fromSchemaInfo(payload.info),
            payload.data
        );
    }

    static toPayload<T>(dto: PayloadDTO<T>): Payload<T> {
        return {
            info: dto.info,
            data: dto.data
        }
    }
}

export const payloadToString: (
    serializer: JSONSerializer
) => <T>(payload: Payload<T>) => string = (serializer) => (payload) => {
    return serializer.serialize(
        PayloadDTO.toJSON(PayloadDTO.fromPayload(payload))
    );
};

export const stringToPayloadDTO: (
    serializer: JSONSerializer
) => <T>(payload: string) => PayloadDTO<T> = (serializer) => (payload) => {
    return PayloadDTO.fromJSON(serializer.deserialize(payload));
};
