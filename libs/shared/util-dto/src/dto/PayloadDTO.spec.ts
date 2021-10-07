import { PayloadDTO } from "./PayloadDTO";
import { SchemaInfoDTO } from "./SchemaInfoDTO";

class Data {
    data: string;
    constructor(data: string) {
        this.data = data;
    }
}

describe("Given a PayloadDTO", () => {
    const payload = new PayloadDTO(
        new SchemaInfoDTO("test", "Data", "V1"),
        new Data("test")
    );

    it("When serializing and deserializing it, then we get back the same object", () => {
        expect(PayloadDTO.fromJSON(PayloadDTO.toJSON(payload))).toEqual(
            payload
        );
    });
});
