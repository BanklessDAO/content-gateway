import { SchemaRepository } from "@domain/feature-gateway";
import { createLogger } from "@shared/util-fp";
import { Schema, SchemaInfo } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

export type ObservableSchemaRepository = SchemaRepository & {
    onChange: (listener: () => void) => void;
};

/**
 * Decorates a schema storage with a side effect that will regenerate
 * the GraphQL api whenever a new schema is saved.
 */
export const toObservableSchemaRepository = (
    schemaRepository: SchemaRepository
): ObservableSchemaRepository => {
    const logger = createLogger("ObservableSchemaRepository");
    const listeners = [] as Array<() => void>;

    const notifyListeners = <T>() =>
        TE.map((result: T) => {
            logger.info("Generating new GraphQL API");
            listeners.forEach((listener) => listener());
            return result;
        });

    return {
        ...schemaRepository,
        register: (schema: Schema) => {
            return pipe(schemaRepository.register(schema), notifyListeners());
        },
        remove: (info: SchemaInfo) => {
            return pipe(schemaRepository.remove(info), notifyListeners());
        },
        onChange: (listener: () => void) => {
            listeners.push(listener);
        },
    };
};
