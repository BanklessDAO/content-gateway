import { Payload } from "@domain/feature-gateway";
import { deserialize, serialize } from "@tsed/json-mapper";
import { Required } from "@tsed/schema";
import * as E from "fp-ts/Either";
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

    static fromJSON<T>(
        data: Record<string, unknown>
    ): E.Either<Error, PayloadDTO<T>> {
        return E.tryCatch(() => deserialize(data, PayloadDTO), E.toError);
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
            data: dto.data,
        };
    }
}
