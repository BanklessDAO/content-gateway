import { Required } from "@tsed/schema";
import { PrismaClient } from "@cga/prisma";
import { ContentGatewayClient } from "@banklessdao/content-gateway-client";

const userKey = {
    namespace: "test",
    name: "User",
    version: "V1",
};

const postKey = {
    namespace: "test",
    name: "Post",
    version: "V1",
};

class Post {
    @Required(true)
    text: string;
}

class City {
    @Required()
    name: string;
    @Required()
    country: string;
    @Required()
    population: number;

    constructor(name: string, country: string, population: number) {
        this.name = name;
        this.country = country;
        this.population = population;
    }
}

class User {
    @Required(true)
    id: string;

    @Required(true)
    name: string;

    @Required(true)
    age: number;

    @Required(true)
    city: City;

    constructor(id: string, name: string, age: number, city: City) {
        this.id = id;
        this.name = name;
        this.age = age;
        this.city = city;
    }
}

export const generateFixtures = async (
    prisma: PrismaClient,
    client: ContentGatewayClient
) => {
    await prisma.data.deleteMany({});
    await prisma.schema.deleteMany({});
    await client.save(postKey, {
        id: "hello-1",
        text: "Hello World",
    });
    await client.register(userKey, User);
    await client.save(userKey, {
        id: "1",
        name: "John Doe",
        age: 30,
        city: {
            name: "New York",
            country: "USA",
            population: 8500000,
        },
    });
    await client.save(userKey, {
        id: "2",
        name: "Jane Doe",
        age: 25,
        city: {
            name: "Paris",
            country: "France",
            population: 2000000,
        },
    });
};
