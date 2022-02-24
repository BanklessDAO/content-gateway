import { createLogger } from "@banklessdao/util-misc";
import {
    ContentGatewayUser,
    DatabaseError,
    UserCreationError,
    UserDeletionError,
    UserNotFoundError,
    UserRepository,
    UserUpdateError,
} from "@domain/feature-gateway";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { Db, ObjectId } from "mongodb";
import { wrapDbOperation } from ".";
import { MongoUser } from "./mongo/MongoUser";

export const mongoUserToCGUser = (user: MongoUser): ContentGatewayUser => {
    return {
        id: user._id.toString(),
        name: user.name,
        roles: user.roles,
        apiKeys: user.apiKeys,
    };
};

type Deps = {
    db: Db;
    usersCollectionName: string;
};

export const createMongoUserRepository = async ({
    db,
    usersCollectionName,
}: Deps): Promise<UserRepository> => {
    const logger = createLogger("MongoUserRepository");
    const users = db.collection<MongoUser>(usersCollectionName);
    await users.createIndex({ name: 1 });
    await users.createIndex({ roles: 1 });
    await users.createIndex({ "apiKeys.id": 1 });
    await users.createIndex({ "apiKeys.hash": 1 });

    const findById = (
        id: string
    ): TE.TaskEither<UserNotFoundError | DatabaseError, ContentGatewayUser> => {
        return pipe(
            wrapDbOperation(() => users.findOne({ _id: new ObjectId(id) }))(),
            TE.chainW((mongoUser) => {
                if (mongoUser) {
                    return TE.right(mongoUserToCGUser(mongoUser));
                } else {
                    return TE.left(
                        new UserNotFoundError(`Couldn't find user by id ${id}`)
                    );
                }
            })
        );
    };

    const findByApiKeyId = (
        apiKeyId: string
    ): TE.TaskEither<UserNotFoundError | DatabaseError, ContentGatewayUser> => {
        return pipe(
            wrapDbOperation(() => users.findOne({ "apiKeys.id": apiKeyId }))(),
            TE.chainW((mongoUser) => {
                if (mongoUser) {
                    return TE.right(mongoUserToCGUser(mongoUser));
                } else {
                    return TE.left(
                        new UserNotFoundError("Couldn't find user by API key.")
                    );
                }
            }),
            TE.mapLeft((e) => {
                logger.error(e);
                return e;
            })
        );
    };

    const createUser = (
        name: string,
        roles: string[]
    ): TE.TaskEither<UserCreationError, ContentGatewayUser> => {
        return pipe(
            wrapDbOperation(() =>
                users.insertOne({
                    name,
                    roles,
                    _id: new ObjectId(),
                    apiKeys: [],
                })
            )(),
            TE.map((result) => {
                return mongoUserToCGUser({
                    _id: result.insertedId,
                    apiKeys: [],
                    name,
                    roles,
                });
            }),
            TE.mapLeft((e) => {
                logger.error(e);
                return new UserCreationError(
                    `Couldn't create user: ${e.message}`
                );
            })
        );
    };

    const updateUser = (
        user: ContentGatewayUser
    ): TE.TaskEither<UserUpdateError, void> => {
        return pipe(
            wrapDbOperation(() =>
                users.updateOne(
                    {
                        _id: new ObjectId(user.id),
                    },
                    {
                        $set: {
                            name: user.name,
                            roles: user.roles,
                            apiKeys: user.apiKeys,
                        },
                    }
                )
            )(),
            TE.map(() => {
                return undefined;
            }),
            TE.mapLeft((e) => {
                logger.error(e);
                return new UserUpdateError(
                    `Couldn't update user: ${e.message}`
                );
            })
        );
    };

    const deleteUser = (
        user: ContentGatewayUser
    ): TE.TaskEither<UserDeletionError, void> => {
        return pipe(
            wrapDbOperation(() =>
                users.deleteOne({
                    _id: new ObjectId(user.id),
                })
            )(),
            TE.map(() => {
                return undefined;
            }),
            TE.mapLeft((e) => {
                logger.error(e);
                return new UserDeletionError(
                    `Couldn't delete user: ${e.message}`
                );
            })
        );
    };

    return {
        findById,
        findByApiKeyId,
        createUser,
        updateUser,
        deleteUser,
    };
};
