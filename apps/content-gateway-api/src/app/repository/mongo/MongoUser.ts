import { SafeApiKey } from "@domain/feature-gateway";
import { ObjectId } from "mongodb";

export type MongoUser = {
    _id: ObjectId;
    name: string;
    roles: string[];
    apiKeys: SafeApiKey[];
};
