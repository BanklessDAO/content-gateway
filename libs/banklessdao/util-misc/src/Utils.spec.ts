import { coercePrimitive } from ".";
describe("utils", () => {
    describe("coercePrimitive", () => {
        it("When 'a' is passed it returns 'a'", () => {
            expect(coercePrimitive("a")).toEqual("a");
        });

        it("When '1.0' is passed it returns 1.0", () => {
            expect(coercePrimitive("1.0")).toEqual(1.0);
        });

        it("When '5' is passed it returns 5", () => {
            expect(coercePrimitive("5")).toEqual(5);
        });

        it("When 'a5' is passed it returns 'a5'", () => {
            expect(coercePrimitive("a5")).toEqual("a5");
        });

        it("When 'true' is passed it returns true", () => {
            expect(coercePrimitive("true")).toEqual(true);
        });

        it("When 'false' is passed it returns false", () => {
            expect(coercePrimitive("false")).toEqual(false);
        });
    })
});
