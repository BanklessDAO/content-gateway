const { PrismaClient } = require(".prisma/client");

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.schema.create({
        data: {
            namespace: "test",
            name: "test",
            version: "V1",
            createdAt: new Date(),
            updatedAt: new Date(),
            schemaObject: {}
        }
    });
    console.dir(result, { depth: null });
}

main()
    .catch((e) => {
        throw e;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });