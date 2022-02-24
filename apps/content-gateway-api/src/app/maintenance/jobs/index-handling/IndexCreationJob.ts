import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/lib/TaskEither";
import * as E from "fp-ts/lib/Either";
import { MaintenanceJob, MaintenanceJobError } from "../..";
import * as t from "io-ts";
import { Db } from "mongodb";
// @ts-expect-error There are no type definitions for this package :'(
import * as DigestFetch from "digest-fetch";
import jobConfig from "../config"

/**
 * Queries MongoDB for index recommendations and then
 * enacts those recommendations
 */
export const createIndexCreationJob = (
    atlasApiInfo: AtlasApiInfo,
    db: Db
): MaintenanceJob => {
    const runIndexCreation = (): TE.TaskEither<MaintenanceJobError, void> => {
        return pipe(
            _queryIndexSuggestions(atlasApiInfo),
            TE.chain(_addIndexes(db))
        );
    };

    return {
        run: runIndexCreation,
        id: "CreateIndexes",
        schedule: jobConfig.indexHandling.schedule
    };
};

export interface AtlasApiInfo {
    publicKey: string;
    privateKey: string;
    projectId: string;
    processId: string;
}

/**
 * INTERNAL OBJECTS, DO NOT USE:
 * they are exported for testing purposes only
 */

/**io-ts codec for verifying external input*/
const IndexSuggestionCodec = t.strict({
    shapes: t.unknown, // We aren't using this so idc what it is
    suggestedIndexes: t.array(
        t.strict({
            id: t.string,
            impact: t.array(t.string),
            index: t.array(t.record(t.string, t.number)),
            namespace: t.string,
            weight: t.number,
        })
    ),
});

export type IndexSuggestions = t.TypeOf<typeof IndexSuggestionCodec>;

// TODO: remove hard coded process Id with automatic discovery of processes
const makeSuggestedIndexUrl = (atlasApiInfo: AtlasApiInfo) =>
    `https://cloud.mongodb.com/api/atlas/v1.0/groups/${atlasApiInfo.projectId}/processes/${atlasApiInfo.processId}/performanceAdvisor/suggestedIndexes`;

/**
 * Retrieves and verifies the request according to these specs
 * https://docs.atlas.mongodb.com/reference/api/pa-suggested-indexes-get-all/
 */
export function _queryIndexSuggestions(
    atlasApiInfo: AtlasApiInfo
): TE.TaskEither<MaintenanceJobError, IndexSuggestions> {
    const client = new DigestFetch(
        atlasApiInfo.publicKey,
        atlasApiInfo.privateKey,
        {}
    );
    const url = makeSuggestedIndexUrl(atlasApiInfo);

    // Query the endpoint for index suggestions
    const unsafeFetch = (): Promise<Response> => client.fetch(url, {});
    const fetch = (): TE.TaskEither<MaintenanceJobError, Response> =>
        TE.tryCatch(
            unsafeFetch,
            (e) => new MaintenanceJobError(new Error(String(e)))
        );

    const parseResponse = (
        res: Response
    ): TE.TaskEither<MaintenanceJobError, IndexSuggestions> => {
        return TE.tryCatch(
            async () => {
                const resJson = await res.json();
                if (E.isLeft(IndexSuggestionCodec.decode(resJson)))
                    throw new Error(
                        `\nIndexSuggestion response failed codec decode\
                         \nExpected IndexSuggestions, got: ${JSON.stringify(
                             resJson
                         )}`
                    );
                return resJson as IndexSuggestions;
            },
            (e) => new MaintenanceJobError(new Error(String(e)))
        );
    };
    return pipe(fetch(), TE.chain(parseResponse));
}

export const _addIndexes =
    (db: Db) =>
    (
        indexSuggestions: IndexSuggestions
    ): TE.TaskEither<MaintenanceJobError, void> => {
        const suggestions = indexSuggestions.suggestedIndexes;

        const addIndex = (
            indexSuggestion: typeof suggestions[number]
        ): TE.TaskEither<MaintenanceJobError, void> => {
            return TE.tryCatch(
                async () => {
                    await db
                        .createIndex(
                            indexSuggestion.namespace,
                            indexSuggestion.index
                        )
                        .catch((r) => {
                            throw new Error(r);
                        });
                    return Promise.resolve();
                },
                (e) => {
                    return e instanceof Error
                        ? new MaintenanceJobError(e)
                        : new MaintenanceJobError(new Error(String(e)));
                }
            );
        };

        return pipe(
            suggestions,
            TE.traverseArray(addIndex),
            TE.map(() => {
                return;
            }) // turn void[] to void cause ts
        );
    };
