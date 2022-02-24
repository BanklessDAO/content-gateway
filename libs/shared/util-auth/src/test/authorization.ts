import { pipe } from "fp-ts/lib/function";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { Policy } from "..";
import { Authorization } from "../Authorization";
import { Context } from "../Context";
import { AnyPermission, Permission } from "../Permission";
import { MissingPermissionError } from "./errors";
import { completeTodo, deleteTodo, findAllTodos, findTodo } from "./operations";
import { roles } from "./roles";
import { Todo } from "./Todo";

const allowAllPolicy =
    <I>(): Policy<I> =>
    (context: Context<I>) =>
        TE.right(context);

const allowForSelfPolicy = (): Policy<Todo> => (context: Context<Todo>) => {
    const { currentUser: user, data } = context;
    if (user.id === data.owner.id) {
        return TE.right(context);
    } else {
        return TE.left(new MissingPermissionError());
    }
};

const filterOnlyPublished = () => (context: Context<Todo[]>) => {
    const { data } = context;
    return TE.right({
        ...context,
        data: data.filter((d) => {
            return pipe(
                O.sequenceArray([d.published, O.some(true)]),
                O.map(([a, b]) => a === b),
                O.fold(
                    () => false,
                    (x) => x
                )
            );
        }),
    });
};

const filterCompletedVisibilityForAnon = () => (context: Context<Todo[]>) => {
    const { data } = context;
    return TE.right({
        ...context,
        data: data.map((d) => {
            return {
                id: d.id,
                owner: d.owner,
                description: d.description,
                completed: O.none,
                published: d.published,
            };
        }),
    });
};

const allowFindPublishedTodosForAnon: Permission<void, Todo[]> = {
    name: "Allow find all todos for anybody",
    operationName: findAllTodos.name,
    policies: [allowAllPolicy()],
    filters: [filterOnlyPublished(), filterCompletedVisibilityForAnon()],
};

const allowFindPublishedTodosForUser: Permission<void, Todo[]> = {
    name: "Allow find all todos for user",
    operationName: findAllTodos.name,
    policies: [allowAllPolicy()],
    filters: [filterOnlyPublished()],
};

const allowFindTodosForAdmin: Permission<void, Todo[]> = {
    name: "Allow find all todos for user",
    operationName: findAllTodos.name,
    policies: [allowAllPolicy()],
};

const allowFindTodoForAnybody: Permission<number, Todo> = {
    name: "Allow find todo for anybody",
    operationName: findTodo.name,
    policies: [allowAllPolicy()],
};

const allowCompleteTodoForSelf: Permission<Todo, Todo> = {
    name: "Allow complete todo for self",
    operationName: completeTodo.name,
    policies: [allowForSelfPolicy()],
};

const allowDeleteTodoForSelf: Permission<Todo, void> = {
    name: "Allow delete todo for self",
    operationName: deleteTodo.name,
    policies: [allowForSelfPolicy()],
};

const allowDeleteTodoForAll: Permission<Todo, void> = {
    name: "Allow delete todo for all",
    operationName: deleteTodo.name,
    policies: [allowAllPolicy()],
};

const anonymousPermissions: AnyPermission[] = [
    allowFindPublishedTodosForAnon,
    allowFindTodoForAnybody,
];

const userPermissions: AnyPermission[] = [
    allowFindPublishedTodosForUser,
    allowFindTodoForAnybody,
    allowCompleteTodoForSelf,
    allowDeleteTodoForSelf,
];

const adminPermissions: AnyPermission[] = [
    allowFindTodosForAdmin,
    allowFindTodoForAnybody,
    allowCompleteTodoForSelf,
    allowDeleteTodoForAll,
];

export const authorization: Authorization = {
    roles: {
        [roles.anonymous]: {
            name: roles.anonymous,
            permissions: anonymousPermissions,
        },
        [roles.user]: {
            name: roles.user,
            permissions: userPermissions,
        },
        [roles.admin]: {
            name: roles.admin,
            permissions: adminPermissions,
        },
    },
};
