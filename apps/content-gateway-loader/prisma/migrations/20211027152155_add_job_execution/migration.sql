/*
  Warnings:

  - You are about to drop the column `finishedAt` on the `Job` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `Job` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Job" DROP COLUMN "finishedAt",
DROP COLUMN "note";

-- CreateTable
CREATE TABLE "JobExecution" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "finishedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL,
    "finalState" "JobState" NOT NULL,

    CONSTRAINT "JobExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobExecution_name_idx" ON "JobExecution"("name");

-- CreateIndex
CREATE INDEX "Job_scheduledAt_idx" ON "Job"("scheduledAt");

-- CreateIndex
CREATE INDEX "Job_cursor_idx" ON "Job"("cursor");

-- CreateIndex
CREATE INDEX "Job_limit_idx" ON "Job"("limit");

-- CreateIndex
CREATE INDEX "Job_state_idx" ON "Job"("state");

-- AddForeignKey
ALTER TABLE "JobExecution" ADD CONSTRAINT "JobExecution_name_fkey" FOREIGN KEY ("name") REFERENCES "Job"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
