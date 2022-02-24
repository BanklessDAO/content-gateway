import { ProgramErrorBase } from "@banklessdao/util-data";
import { SchemaInfo } from "@banklessdao/util-schema";
import {
    APIKey,
    ContentGatewayUser,
    CreateAPIKeyParams,
    CreateUserParams,
    CREATE_API_KEY,
    CREATE_USER,
    DeleteAPIKeyParams,
    DELETE_API_KEY,
    DELETE_USER,
    FindSchemaForParams,
    FindSchemaForResult,
    FIND_SCHEMA_FOR,
    LOAD_SCHEMA_STATS,
    REGISTER_SCHEMA,
    REMOVE_SCHEMA,
    SaveDataParams,
    SAVE_DATA,
    SchemaEntity,
    SchemaStat
} from "@domain/feature-gateway";
import {
    AnyPermission,
    Authorization,
    Context,
    Permission,
    Policy
} from "@shared/util-auth";
import * as TE from "fp-ts/TaskEither";
import { ContentGatewayRoles } from "./ContentGatewayRoles";

export class MissingPermissionError extends ProgramErrorBase<"MissingPermissionError"> {
    constructor() {
        super({
            _tag: "MissingPermissionError",
            message: `"The current user can't perform this operation."`,
        });
    }
}

const allowAllPolicy =
    <I>(): Policy<I> =>
    (context: Context<I>) =>
        TE.right(context);

const allowForSelfPolicy =
    <I extends { owner: ContentGatewayUser }>(): Policy<I> =>
    (context: Context<I>) => {
        const { currentUser, data } = context;
        if (currentUser.id === data.owner.id) {
            return TE.right(context);
        } else {
            return TE.left(new MissingPermissionError());
        }
    };

const allowLoadSchemaStats: Permission<void, Array<SchemaStat>> = {
    name: "Allows reading schema stats",
    operationName: LOAD_SCHEMA_STATS,
    policies: [allowAllPolicy()],
};

const allowRegisterSchema: Permission<SchemaInfo, void> = {
    name: "Allows creating schemas for the current user",
    operationName: REGISTER_SCHEMA,
    policies: [allowAllPolicy()],
};

const allowFindSchemaFor = <T>(): Permission<
    FindSchemaForParams<T>,
    FindSchemaForResult<T>
> => ({
    name: "Allows finding schemas for object having schema info",
    operationName: FIND_SCHEMA_FOR,
    policies: [allowAllPolicy()],
});

const allowRemoveSchema: Permission<SchemaEntity, void> = {
    name: "Allows removing schemas",
    operationName: REMOVE_SCHEMA,
    policies: [allowAllPolicy()],
};

const allowCreateUser: Permission<CreateUserParams, ContentGatewayUser> = {
    name: "Allows creating users",
    operationName: CREATE_USER,
    policies: [allowAllPolicy()],
};

const allowCreateApiKey: Permission<CreateAPIKeyParams, APIKey> = {
    name: "Allows creating API Keys",
    operationName: CREATE_API_KEY,
    policies: [allowAllPolicy()],
};

const allowDeleteUser: Permission<string, void> = {
    name: "Allows deleting users",
    operationName: DELETE_USER,
    policies: [allowAllPolicy()],
};

const allowDeleteApiKey: Permission<DeleteAPIKeyParams, void> = {
    name: "Allows deleting API Keys",
    operationName: DELETE_API_KEY,
    policies: [allowAllPolicy()],
};

const allowRemoveSchemaForOwn: Permission<SchemaEntity, void> = {
    name: "Allows removing schemas for the current user",
    operationName: REMOVE_SCHEMA,
    policies: [allowForSelfPolicy()],
};

const allowSaveData = (): Permission<SaveDataParams, void> => ({
    name: "Allows saving data",
    operationName: SAVE_DATA,
    policies: [allowAllPolicy()],
});

const allowSaveDataForOwn = (): Permission<SaveDataParams, void> => ({
    name: "Allows saving data for schemas that are owned by the current user",
    operationName: SAVE_DATA,
    policies: [allowForSelfPolicy()],
});

const allowCreateApiKeyForOwn: Permission<CreateAPIKeyParams, APIKey> = {
    name: "Allows creating API Keys for the current user",
    operationName: CREATE_API_KEY,
    policies: [allowForSelfPolicy()],
};

const allowDeleteApiKeyForOwn: Permission<DeleteAPIKeyParams, void> = {
    name: "Allows deleting API Keys for their owner",
    operationName: DELETE_API_KEY,
    policies: [allowForSelfPolicy()],
};

// * Anons can't do anything for now.
const anonymousPermissions: AnyPermission[] = [];

const userPermissions: AnyPermission[] = [
    allowRegisterSchema,
    allowFindSchemaFor<any>(),
    allowRemoveSchemaForOwn,
    allowSaveDataForOwn(),
    allowCreateApiKeyForOwn,
    allowDeleteApiKeyForOwn,
];

const adminPermissions: AnyPermission[] = [
    allowRegisterSchema,
    allowLoadSchemaStats,
    allowFindSchemaFor<any>(),
    allowRemoveSchema,
    allowCreateUser,
    allowCreateApiKey,
    allowDeleteUser,
    allowDeleteApiKey,
    allowSaveData(),
];

const rootPermissions: AnyPermission[] = [
    allowRegisterSchema,
    allowLoadSchemaStats,
    allowFindSchemaFor<any>(),
    allowRemoveSchema,
    allowCreateUser,
    allowCreateApiKey,
    allowDeleteUser,
    allowDeleteApiKey,
    allowSaveData(),
];

const ANON_USER_ID = "1fa0fd73-03cb-4b3c-8350-47a2d7c27dc4";

export const ANON_USER: ContentGatewayUser = {
    id: ANON_USER_ID,
    name: "Anonymous",
    apiKeys: [],
    roles: [ContentGatewayRoles.anonymous],
};

export const authorization: Authorization = {
    roles: {
        [ContentGatewayRoles.anonymous]: {
            name: ContentGatewayRoles.anonymous,
            permissions: anonymousPermissions,
        },
        [ContentGatewayRoles.user]: {
            name: ContentGatewayRoles.user,
            permissions: userPermissions,
        },
        [ContentGatewayRoles.admin]: {
            name: ContentGatewayRoles.admin,
            permissions: adminPermissions,
        },
        [ContentGatewayRoles.root]: {
            name: ContentGatewayRoles.root,
            permissions: rootPermissions,
        },
    },
};
