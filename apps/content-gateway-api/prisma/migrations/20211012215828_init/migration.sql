-- CreateTable
CREATE TABLE "Schema" (
    "namespace" CHAR(50) NOT NULL,
    "name" CHAR(50) NOT NULL,
    "version" CHAR(50) NOT NULL,
    "schemaObject" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(6),

    CONSTRAINT "Schema_pkey" PRIMARY KEY ("namespace","name","version")
);

-- CreateTable
CREATE TABLE "Data" (
    "id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL,
    "updatedAt" TIMESTAMP(6) NOT NULL,
    "deletedAt" TIMESTAMP(6),
    "schemaNamespace" CHAR(50) NOT NULL,
    "schemaName" CHAR(50) NOT NULL,
    "schemaVersion" CHAR(50) NOT NULL,

    CONSTRAINT "Data_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Data" ADD CONSTRAINT "Data_schemaNamespace_schemaName_schemaVersion_fkey" FOREIGN KEY ("schemaNamespace", "schemaName", "schemaVersion") REFERENCES "Schema"("namespace", "name", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
