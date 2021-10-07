import { SchemaDTO, SchemaInfoDTO } from ".";

describe("Given a SchemaDTO", () => {
    const schema = new SchemaDTO(
        new SchemaInfoDTO("test", "Test", "V1"),
        "hello"
    );

    it("When serializing and deserializing it, then we get back the same object", () => {
        expect(SchemaDTO.fromJSON(SchemaDTO.toJSON(schema))).toEqual(schema);
    });
});
