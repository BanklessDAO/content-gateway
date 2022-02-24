import { SchemaInfo } from "@banklessdao/util-schema";
import { Authorization, authorize, ContextTaskEither } from "@shared/util-auth";
import { flow } from "fp-ts/lib/function";
import {
    APIKey,
    ContentGatewayUser,
    CreateAPIKeyParams,
    CreateUserParams,
    DataRepository,
    DeleteAPIKeyParams,
    DeleteUserParams,
    makeCreateAPIKey,
    makeCreateUser,
    makeDeleteAPIKey,
    makeDeleteUser,
    makeFindSchemaFor,
    makeLoadSchemaStats,
    makeRegisterSchema,
    makeRemoveSchema,
    makeSaveData,
    RegisterSchemaParams,
    SchemaRepository,
    SchemaStat,
    UserRepository
} from "..";

export type SaveDataRawParams = {
    info: SchemaInfo;
    records: Array<Record<string, unknown>>;
};

export type ContentGateway = {
    saveData: (
        context: ContextTaskEither<SaveDataRawParams>
    ) => ContextTaskEither<void>;
    registerSchema: (
        context: ContextTaskEither<RegisterSchemaParams>
    ) => ContextTaskEither<void>;
    removeSchema: (
        context: ContextTaskEither<SchemaInfo>
    ) => ContextTaskEither<void>;
    createAPIKey: (
        context: ContextTaskEither<CreateAPIKeyParams>
    ) => ContextTaskEither<APIKey>;
    createUser: (
        context: ContextTaskEither<CreateUserParams>
    ) => ContextTaskEither<ContentGatewayUser>;
    deleteAPIKey: (
        context: ContextTaskEither<DeleteAPIKeyParams>
    ) => ContextTaskEither<void>;
    deleteUser: (
        userId: ContextTaskEither<DeleteUserParams>
    ) => ContextTaskEither<void>;
    loadSchemaStats: (
        context: ContextTaskEither<void>
    ) => ContextTaskEither<Array<SchemaStat>>;
};

type Deps = {
    dataRepository: DataRepository;
    userRepository: UserRepository;
    schemaRepository: SchemaRepository;
    authorization: Authorization;
};

export const createContentGateway = (deps: Deps): ContentGateway => {
    const { dataRepository, userRepository, schemaRepository, authorization } =
        deps;

    const createUser = makeCreateUser(userRepository);
    const deleteUser = makeDeleteUser(userRepository);
    const createAPIKey = makeCreateAPIKey(userRepository);
    const deleteAPIKey = makeDeleteAPIKey(userRepository);
    const findSchemaForSaveData =
        makeFindSchemaFor<SaveDataRawParams>(schemaRepository);
    const findSchemaForRemoveSchema =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        makeFindSchemaFor<any>(schemaRepository);
    const registerSchema = makeRegisterSchema(schemaRepository);
    const removeSchema = makeRemoveSchema(schemaRepository);
    const loadSchemaStats = makeLoadSchemaStats(schemaRepository);
    const saveData = makeSaveData(dataRepository);

    const authFindSchemaForSaveData = authorize(
        findSchemaForSaveData,
        authorization
    );
    const authFindSchemaForRemoveSchema = authorize(
        findSchemaForRemoveSchema,
        authorization
    );

    const authSaveData = authorize(saveData, authorization);
    const authRemoveSchema = authorize(removeSchema, authorization);

    return {
        createUser: authorize(createUser, authorization),
        deleteUser: authorize(deleteUser, authorization),
        createAPIKey: authorize(createAPIKey, authorization),
        deleteAPIKey: authorize(deleteAPIKey, authorization),
        registerSchema: authorize(registerSchema, authorization),
        loadSchemaStats: authorize(loadSchemaStats, authorization),
        removeSchema: flow(authFindSchemaForRemoveSchema, authRemoveSchema),
        saveData: flow(authFindSchemaForSaveData, authSaveData),
    };
};
