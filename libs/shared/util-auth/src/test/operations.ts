import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { Operation } from "..";
import { TodoNotFoundError } from "./errors";
import { todos } from "./fixtures";
import { Todo } from "./Todo";

export const findAllTodos: Operation<void, Array<Todo>> = {
    name: "findAllTodos",
    execute: () => {
        return TE.right(Object.values(todos));
    },
};

export const findTodo: Operation<number, Todo> = {
    name: "findTodo",
    execute: (id: number) => {
        const todo = todos[id];
        if (todo) {
            return TE.right(todo);
        } else {
            return TE.left(new TodoNotFoundError(id));
        }
    },
};

export const completeTodo: Operation<Todo, Todo> = {
    name: "completeTodo",
    execute: (input: Todo) => {
        input.completed = O.some(true);
        return TE.right(input);
    },
};

export const deleteTodo: Operation<Todo, void> = {
    name: "deleteTodo",
    execute: (input: Todo) => {
        input.completed = O.some(true);
        return TE.right(undefined);
    },
};
