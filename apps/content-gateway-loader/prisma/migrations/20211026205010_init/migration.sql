-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Job" (
    "name" VARCHAR(50) NOT NULL,
    "scheduledAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" "JobState" NOT NULL DEFAULT E'SCHEDULED',
    "data" JSONB NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("name")
);
