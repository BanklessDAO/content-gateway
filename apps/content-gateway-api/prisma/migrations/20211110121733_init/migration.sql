-- CreateTable
CREATE TABLE "Schema" (
    "namespace" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "jsonSchema" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "Schema_pkey" PRIMARY KEY ("namespace","name","version")
);

-- CreateTable
CREATE TABLE "Data" (
    "id" BIGSERIAL NOT NULL,
    "upstreamId" VARCHAR(255) NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(6),
    "namespace" VARCHAR(50) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "version" VARCHAR(50) NOT NULL,

    CONSTRAINT "Data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schema_createdAt_idx" ON "Schema"("createdAt");

-- CreateIndex
CREATE INDEX "Schema_updatedAt_idx" ON "Schema"("updatedAt");

-- CreateIndex
CREATE INDEX "Schema_deletedAt_idx" ON "Schema"("deletedAt");

-- CreateIndex
CREATE INDEX "Data_createdAt_idx" ON "Data"("createdAt");

-- CreateIndex
CREATE INDEX "Data_updatedAt_idx" ON "Data"("updatedAt");

-- CreateIndex
CREATE INDEX "Data_deletedAt_idx" ON "Data"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Data_namespace_name_version_upstreamId_key" ON "Data"("namespace", "name", "version", "upstreamId");

-- AddForeignKey
ALTER TABLE "Data" ADD CONSTRAINT "Data_namespace_name_version_fkey" FOREIGN KEY ("namespace", "name", "version") REFERENCES "Schema"("namespace", "name", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
