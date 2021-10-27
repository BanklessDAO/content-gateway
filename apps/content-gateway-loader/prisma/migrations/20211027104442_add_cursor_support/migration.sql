/*
  Warnings:

  - Added the required column `cursor` to the `Job` table without a default value. This is not possible if the table is not empty.
  - Added the required column `limit` to the `Job` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "cursor" TIMESTAMP(6) NOT NULL,
ADD COLUMN     "limit" BIGINT NOT NULL;
