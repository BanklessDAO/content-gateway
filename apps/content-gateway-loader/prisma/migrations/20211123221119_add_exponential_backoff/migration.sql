-- AlterTable
ALTER TABLE "JobSchedule" ADD COLUMN     "currentFailCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ranPreviouslyAt" TIMESTAMP(6);
