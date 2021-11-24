import * as O from "fp-ts/Option";
import { Entity } from "../Entity";

export interface Todo extends Entity<number> {
    id: number;
    description: O.Option<string>;
    completed: O.Option<boolean>;
    published: O.Option<boolean>;
}

