import { Db } from "mongodb";
import {
    AtlasApiInfo,
    createIndexCreationJob
} from "./index-handling/IndexCreationJob";

export const createJobs = (jobConfig: JobConfig, db: Db) => {
    return [createIndexCreationJob(jobConfig.atlasApiInfo, db)];
};

export interface JobConfig {
    atlasApiInfo: AtlasApiInfo;
}
