import { Operation } from "@shared/util-auth";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import {
    BatchDataReceivingError,
    ContentGatewayUser,
    DataRepository,
    SchemaEntity
} from "..";

export const SAVE_DATA = "SAVE_DATA";

export type SaveDataParams = {
    schema: SchemaEntity;
    owner: ContentGatewayUser;
    records: Array<Record<string, unknown>>;
};

export type SaveData = Operation<SaveDataParams, void>;

/**
 * Saves a new payload of data. The payload is validated and it must correspond
 * to a registered schema. If payload is invalid according to the schema
 * an error will be returned.
 */
export const makeSaveData = (dataRepository: DataRepository): SaveData => ({
    name: SAVE_DATA,
    execute: ({ schema, records }: SaveDataParams) => {
        return pipe(
            dataRepository.store({
                info: schema.info,
                records,
            }),
            TE.mapLeft((err) => {
                return new BatchDataReceivingError(err);
            }),
            TE.map(() => undefined)
        );
    },
});
