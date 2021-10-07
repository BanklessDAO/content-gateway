var express = require("express");
var { graphqlHTTP } = require("express-graphql");
var graphql = require("graphql");
const { convertCompilerOptionsFromJson } = require("typescript");


// Maps id to User object
var fakeDatabase = {
    a: {
        id: "a",
        name: "alice",
        address: {
            address: "hello",
        },
    },
    b: {
        id: "b",
        name: "bob",
        address: {
            address: "hello",
        },
    },
};

var addressType = new graphql.GraphQLObjectType({
    name: "Address",
    fields: {
        address: { type: graphql.GraphQLString },
    },
});

// Define the User type
var userType = new graphql.GraphQLObjectType({
    name: "User",
    fields: {
        id: { type: graphql.GraphQLNonNull(graphql.GraphQLString) },
        name: { type: graphql.GraphQLNonNull(graphql.GraphQLString) },
        address: { type: graphql.GraphQLNonNull(addressType) },
    },
});

// Define the Query type
var queryType = new graphql.GraphQLObjectType({
    name: "Query",
    fields: {
        user: {
            type: graphql.GraphQLNonNull(userType),
            // `args` describes the arguments that the `user` query accepts
            args: {
                id: { type: graphql.GraphQLNonNull(graphql.GraphQLString) },
            },
            resolve: (_, { id }) => {
                return fakeDatabase[id];
            },
        },
        users: {
            type: graphql.GraphQLNonNull(graphql.GraphQLList(userType)),
            resolve: () => {
                return Object.values(fakeDatabase);
            },
        },
    },
});

var schema = new graphql.GraphQLSchema({ query: queryType });

console.log(graphql.printSchema(schema));

var app = express();
app.use(
    "/graphql",
    graphqlHTTP({
        schema: schema,
        graphiql: true,
    })
);
app.listen(4000);
console.log("Running a GraphQL API server at localhost:4000/graphql");
