// eslint-disable-next-line @nrwl/nx/enforce-module-boundaries
import { createLogger } from "@banklessdao/util-misc";
import {
    SchemaInfo,
    schemaInfoToString,
    stringToSchemaInfo,
} from "@banklessdao/util-schema";
import {
    DatabaseError,
    Job,
    JobRepository,
    JobState,
} from "@shared/util-loaders";
import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as TO from "fp-ts/TaskOption";
import { Db, Document, ModifyResult } from "mongodb";
import { MongoJob, wrapDbOperation } from ".";

type Deps = {
    db: Db;
    collName: string;
};

class DocumentError extends Error {
    constructor(document: Document) {
        super(JSON.stringify(document));
    }
}

export const createMongoJobRepository = async ({
    db,
    collName,
}: Deps): Promise<JobRepository> => {
    const jobs = db.collection<MongoJob>(collName);

    await jobs.createIndex({ name: 1 }, { unique: true });
    await jobs.createIndex({ scheduledAt: 1 });
    await jobs.createIndex({ cursor: 1 });
    await jobs.createIndex({ state: 1 });

    const logger = createLogger("PrismaJobRepository");

    const mongoJobToJob = (mongoJob: MongoJob): Job => ({
        cursor: mongoJob.cursor,
        limit: mongoJob.limit,
        info: stringToSchemaInfo(mongoJob.name),
        state: mongoJob.state,
        scheduleMode: mongoJob.scheduleMode,
        scheduledAt: mongoJob.scheduledAt,
        updatedAt: mongoJob.updatedAt,
        previousScheduledAt: mongoJob.previousScheduledAt,
        currentFailCount: mongoJob.currentFailCount,
    });

    const upsertJob = (
        job: Job,
        note: string,
        info: Record<string, unknown>
    ): TE.TaskEither<DatabaseError, Job> => {
        const name = schemaInfoToString(job.info);
        logger.info(
            `Updating job ${name} with state ${job.state} and note '${note}'.`
        );
        const state = job.state;
        return pipe(
            wrapDbOperation(() => {
                return jobs.findOneAndUpdate(
                    {
                        name,
                    },
                    {
                        $set: {
                            state: state,
                            scheduleMode: job.scheduleMode,
                            cursor: job.cursor,
                            limit: job.limit,
                            currentFailCount: job.currentFailCount,
                            previousScheduledAt: job.previousScheduledAt,
                            scheduledAt: job.scheduledAt,
                            updatedAt: new Date(),
                        },
                        $setOnInsert: {
                            name: name,
                            createdAt: new Date(),
                            $push: {
                                logs: {
                                    note: note,
                                    state: state,
                                    info: info,
                                    createdAt: new Date(),
                                },
                                $slice: -100,
                            },
                        },
                    },
                    {
                        upsert: true,
                        returnDocument: "after",
                    }
                );
            })(),
            TE.chainW((result: ModifyResult<MongoJob>) => {
                if (result.ok === 1 && result.value) {
                    return TE.right(mongoJobToJob(result.value));
                } else {
                    return TE.left(
                        new DatabaseError(
                            new DocumentError(result.lastErrorObject ?? {})
                        )
                    );
                }
            })
        );
    };

    const findAll = (): T.Task<Job[]> => {
        return pipe(
            () => jobs.find().toArray(),
            T.map((records) => records.map(mongoJobToJob))
        );
    };

    const findJob = (info: SchemaInfo): TO.TaskOption<Job | null> => {
        return pipe(
            TO.tryCatch(async () => {
                const name = schemaInfoToString(info);
                return jobs.find({ name }).toArray();
            }),
            TO.map((data) => {
                if (data.length === 0) {
                    return null;
                } else {
                    return mongoJobToJob(data[0]);
                }
            })
        );
    };

    const remove = (name: string): TE.TaskEither<DatabaseError, void> => {
        return pipe(
            wrapDbOperation(() => {
                return jobs.deleteOne({ name });
            })(),
            TE.chain((result) => {
                if (result.acknowledged) {
                    return TE.right(undefined);
                } else {
                    return TE.left(new DatabaseError("Failed to remove job."));
                }
            })
        );
    };
    const removeAll = (): TE.TaskEither<DatabaseError, void> => {
        return pipe(
            wrapDbOperation(() => {
                return jobs.deleteMany({});
            })(),
            TE.chain((result) => {
                if (result.acknowledged) {
                    return TE.right(undefined);
                } else {
                    return TE.left(new DatabaseError("Failed to remove job."));
                }
            })
        );
    };

    const loadNextJobs = (): T.Task<Job[]> => {
        return pipe(
            () =>
                jobs
                    .find({
                        state: JobState.SCHEDULED,
                        scheduledAt: { $lte: new Date() },
                    })
                    .toArray(),
            T.map((records) => records.map(mongoJobToJob))
        );
    };

    return {
        upsertJob,
        findJob,
        findAll,
        remove,
        removeAll,
        loadNextJobs,
    };
};
