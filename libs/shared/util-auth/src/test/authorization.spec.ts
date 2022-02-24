import { extractLeft, extractRight } from "@banklessdao/util-misc";
import { pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { AuthorizationError } from "..";
import { authorize } from "../Authorization";
import { Context } from "../Context";
import { authorization } from "./authorization";
import { anonUser, todos, userJane, userJohn } from "./fixtures";
import { deleteTodo, findAllTodos, findTodo } from "./operations";

describe("Given some authorized operations", () => {
    const authorizedFind = authorize(findTodo, authorization);
    const authorizedDelete = authorize(deleteTodo, authorization);
    const authorizedFindAll = authorize(findAllTodos, authorization);

    const anonContext: Context<number> = {
        currentUser: anonUser,
        data: 1,
    };

    const janesContext: Context<number> = {
        currentUser: userJane,
        data: 2,
    };

    it("When finding all todos for anon Then it returns only published without completed", async () => {
        const result = extractRight(
            await authorizedFindAll(
                TE.right({ currentUser: anonUser, data: undefined })
            )()
        ).data.map((todo) => ({
            id: todo.id,
            completed: todo.completed,
        }));

        expect(result).toEqual([
            { id: 1, completed: O.none },
            { id: 3, completed: O.none },
        ]);
    });

    it("When finding all todos for a registered user Then it returns only published", async () => {
        const result = extractRight(
            await authorizedFindAll(
                TE.right({ currentUser: userJohn, data: undefined })
            )()
        ).data.map((todo) => ({
            id: todo.id,
            completed: todo.completed,
        }));

        expect(result).toEqual([
            { id: 1, completed: O.some(true) },
            { id: 3, completed: O.some(false) },
        ]);
    });

    it("When trying to find", async () => {
        const result = extractRight(
            await authorizedFind(TE.right(anonContext))()
        );

        expect(result.data.id).toBe(todos[1].id);
    });
    it("When trying to delete with anon", async () => {
        const result = extractLeft(
            await pipe(
                TE.right(anonContext),
                authorizedFind,
                authorizedDelete
            )()
        );

        expect(result).toEqual(
            new AuthorizationError(
                "Current user anonymous has no permission to perform deleteTodo"
            )
        );
    });
    it("When trying to delete with an authorized user", async () => {
        const result = extractRight(
            await pipe(
                TE.right(janesContext),
                authorizedFind,
                authorizedDelete
            )()
        );

        expect(result.data).toBeUndefined();
    });
});
