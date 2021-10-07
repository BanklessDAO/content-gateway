import { SchemaInfoDTO } from ".";

describe("Given a SchemaInfoDTO", () => {
    const info = new SchemaInfoDTO("test", "Test", "V1");

    it("When serializing and deserializing it, then we get back the same object", () => {
        expect(SchemaInfoDTO.fromJSON(SchemaInfoDTO.toJSON(info))).toEqual(
            info
        );
    });
});
