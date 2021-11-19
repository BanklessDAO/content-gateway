import {createFiltersFor} from "./Filters"
import * as g from "graphql";

describe("Given a type", () => {

    const type = new g.GraphQLObjectType({
        name: "Test",
        fields:  {
            id: {
                type: g.GraphQLID,
            }
        },
    })

    it("When I create filters for it Then it is OK", () => {
        console.log(g.GraphQLInt.name);
    });
});
