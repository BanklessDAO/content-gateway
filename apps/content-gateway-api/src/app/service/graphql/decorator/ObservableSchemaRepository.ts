import { SchemaRepository } from "@domain/feature-gateway";
import { createLogger } from "@shared/util-fp";
import { Schema } from "@shared/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

export type ObservableSchemaRepository = SchemaRepository & {
    onRegister: (listener: () => void) => void;
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
    return {
        ...schemaRepository,
        register: (schema: Schema) => {
            return pipe(
                schemaRepository.register(schema),
                TE.map((result) => {
                    logger.info("Generating new GraphQL API");
                    listeners.forEach((listener) => listener());
                    return result;
                })
            );
        },
        onRegister: (listener: () => void) => {
            listeners.push(listener);
        },
    };
};
