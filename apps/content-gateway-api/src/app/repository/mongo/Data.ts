import { ObjectId } from "mongodb";

// @@unique([namespace, name, version, upstreamId])
// @@index([createdAt])
// @@index([updatedAt])
// @@index([deletedAt])

export type Data = {
    _id: ObjectId;
    id: string;
    data: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date;
};
