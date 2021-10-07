import { PayloadDTO, payloadToString } from "./PayloadDTO";
import { SchemaInfoDTO } from "./SchemaInfoDTO";
import {createDefaultJSONSerializer} from "@shared/util-schema"

class Data {
    data: string;
    constructor(data: string) {
        this.data = data;
    }
}

const expectedJSON = `{"info":{"namespace":"test","name":"Data","version":"V1"},"data":{"data":"test"}}`

describe("Given a PayloadDTO", () => {
    const payload = new PayloadDTO(
        new SchemaInfoDTO("test", "Data", "V1"),
        new Data("test")
    );

    const payloadSerializer = payloadToString(createDefaultJSONSerializer());

    it("When serializing and deserializing it, then we get back the same object", () => {
        expect(PayloadDTO.fromJSON(PayloadDTO.toJSON(payload))).toEqual(
            payload
        );
    });

    it("When converted to string it properly executes", () => {
        expect(payloadSerializer(payload)).toEqual(expectedJSON);
    });
});
