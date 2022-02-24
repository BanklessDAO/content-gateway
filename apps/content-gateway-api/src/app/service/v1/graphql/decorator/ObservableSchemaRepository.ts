import {
    ContentGatewayUser,
    SchemaEntity,
    SchemaRepository,
} from "@domain/feature-gateway";
import { createLogger } from "@banklessdao/util-misc";
import { Schema, SchemaInfo } from "@banklessdao/util-schema";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";

/**
 * Adds the ability to listen to changes in the state of the
 * {@link SchemaRepository} to an instance of it (decorator pattern).
 */
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
        register: (schema: Schema, owner: ContentGatewayUser) => {
            return pipe(
                schemaRepository.register(schema, owner),
                notifyListeners()
            );
        },
        remove: (schema: SchemaEntity) => {
            return pipe(schemaRepository.remove(schema), notifyListeners());
        },
        onChange: (listener: () => void) => {
            listeners.push(listener);
        },
    };
};
