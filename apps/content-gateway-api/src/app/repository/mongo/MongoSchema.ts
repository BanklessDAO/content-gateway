export type MongoSchema = {
    key: string;
    jsonSchema: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
};
