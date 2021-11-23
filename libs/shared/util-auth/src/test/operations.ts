import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { TodoNotFoundError } from "./errors";
import { todos } from "./fixtures";
import { Todo } from "./Todo";

export const findAllTodos = () => {
    return TE.right(Object.values(todos));
};

export const findTodo = (id: number) => {
    const todo = todos[id];
    if (todo) {
        return TE.right(todo);
    } else {
        return TE.left(new TodoNotFoundError(id));
    }
};

export const completeTodo = (input: Todo) => {
    input.completed = O.some(true);
    return TE.right(input);
};

export const deleteTodo = (input: Todo) => {
    input.completed = O.some(true);
    return TE.right(undefined);
};
