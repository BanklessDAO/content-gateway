import * as t from "io-ts";

export const idPropertyCodec = t.exact(
    t.type({
        type: t.literal("string"),
        minLength: t.literal(1),
    })
);

export type IdProperty = t.TypeOf<typeof idPropertyCodec>;

export const booleanPropertyCodec = t.exact(
    t.type({
        type: t.literal("boolean"),
    })
);

export type BooleanProperty = t.TypeOf<typeof booleanPropertyCodec>;

export const numberPropertyCodec = t.exact(
    t.type({
        type: t.literal("number"),
    })
);

export type NumberProperty = t.TypeOf<typeof numberPropertyCodec>;

export const stringPropertyCodec = t.exact(
    t.intersection([
        t.type({ type: t.literal("string") }),
        t.partial({ minLength: t.number }),
    ])
);

export type StringProperty = t.TypeOf<typeof stringPropertyCodec>;

export const arrayPropertyCodec = t.exact(
    t.type({
        type: t.literal("array"),
        items: t.type({ type: t.literal("string") }),
    })
);

export type ArrayProperty = t.TypeOf<typeof arrayPropertyCodec>;

export const refPropertyCodec = t.exact(
    t.type({
        $ref: t.string,
    })
);

export type RefProperty = t.TypeOf<typeof refPropertyCodec>;

export const arrayRefPropertyCodec = t.exact(
    t.type({
        type: t.literal("array"),
        items: t.type({ $ref: t.string }),
    })
);

export type ArrayRefProperty = t.TypeOf<typeof arrayRefPropertyCodec>;

export const supportedPropertyCodec = t.union([
    idPropertyCodec,
    booleanPropertyCodec,
    numberPropertyCodec,
    stringPropertyCodec,
    arrayPropertyCodec,
    refPropertyCodec,
    arrayRefPropertyCodec,
]);

export const supportedPropertyRecordCodec = t.record(
    t.string,
    supportedPropertyCodec
);

export type SupportedProperty = t.TypeOf<typeof supportedPropertyCodec>;

export const jsonSchemaTypeCodec = t.intersection([
    t.exact(
        t.type({
            type: t.literal("object"),
            properties: supportedPropertyRecordCodec,
        })
    ),
    t.exact(t.partial({ required: t.array(t.string) })),
]);

export type JSONSchemaType = t.TypeOf<typeof jsonSchemaTypeCodec>;

export const supportedJSONSchemaCodec = t.intersection([
    jsonSchemaTypeCodec,
    t.exact(
        t.partial({
            definitions: t.record(t.string, jsonSchemaTypeCodec),
        })
    ),
]);

export type SupportedJSONSchema = t.TypeOf<typeof supportedJSONSchemaCodec>;

export const hasId = t.type({
    properties: t.record(t.string, t.type({ id: t.string })),
});
