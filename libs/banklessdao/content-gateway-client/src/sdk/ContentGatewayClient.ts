import {
    KeyDTO,
    keyToString,
    PayloadDTO,
    RegistrationDTO,
    TypeKey,
} from "@shared/util-schema";
import { Type } from "@tsed/core";
import { serialize } from "@tsed/json-mapper";
import { getJsonSchema } from "@tsed/schema";
import Ajv from "ajv";
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";

/**
 * The SDK is the client-side component of the Content Gateway.
 * This can be used for push-style communication with it.
 */
export type ContentGatewayClient = {
    /**
     * Register a new unique Type in the SDK.
     * Use @tsed/schema decorators when creating the Type.
     * Example:
     * ```
     * class User {
     *     @Required(true)
     *     id: number;
     *     @Required(true)
     *     name: string;
     *     @Required(true)
     *     email: string;
     *
     *     constructor(id: number, name: string, email: string) {
     *         this.id = id;
     *         this.name = name;
     *         this.email = email;
     *     }
     * }
     * ```
     */
    register: <T>(key: TypeKey<T>, type: Type<T>) => E.Either<Error, void>;
    /**
     * Sends [[data]] to the Content Gateway using the [[key]] as the unique identifier.
     * This will return an error if the type of [[data]] is not [[register]]ed.
     */
    send: <T>(key: TypeKey<T>, data: T) => E.Either<Error, void>;
};

/**
 * This abstraction hides the implementation details of how data is sent over the wire.
 */
export type OutboundSDKAdapter = {
    register: (registration: string) => E.Either<Error, void>;
    send: (payload: string) => E.Either<Error, void>;
};

/**
 * Factory function for creating an [[SDK]] instance.
 */
export type SDKFactory = (adapter: OutboundSDKAdapter) => ContentGatewayClient;

/**
 * This object is instantiated in the client.
 */
export const createSDK: SDKFactory = (adapter: OutboundSDKAdapter) => {
    const ajv = new Ajv();
    const schema = getJsonSchema(PayloadDTO);
    const types = new Map<string, Type<any>>();
    return {
        register: <T>(
            key: TypeKey<T>,
            type: Type<T>
        ): E.Either<Error, void> => {
            return E.tryCatch(
                () => {
                    // 💡 this is necessary because we use
                    const schemaStr = typeToString(type);
                    types.set(keyToString(key), type);
                    const registration = new RegistrationDTO(key, schemaStr);
                    adapter.register(
                        serialize(registration, {
                            type: RegistrationDTO,
                        })
                    );
                },
                (reason) => new Error(String(reason))
            );
        },
        send: <T>(key: TypeKey<T>, data: T): E.Either<Error, void> => {
            // 💡 a pipe is similar to what the pipeline operator (|>) will be in the future
            // (more info here: https://github.com/tc39/proposal-pipeline-operator)
            // in short, pipe(f, g, h) is equivalent to f(g(h(...)))
            const keyStr = keyToString(key);
            const t = types.get(keyStr);
            let maybeType: E.Either<Error, Type<T>>;
            if (t) {
                maybeType = E.right(t);
            } else {
                maybeType = E.left(
                    new Error(`Type ${keyStr} is not registered`)
                );
            }
            return pipe(
                // this will either have a type or an error
                maybeType,
                // which we re-wrap in another either depending on the outcome
                // E.chain here will only be called if find returned a Right (meaning no error)
                E.chain((type) => {
                    // 💡 We'll validate locally and on the server-side too.

                    const payload = new PayloadDTO(
                        new KeyDTO(key.namespace, key.name, key.version),
                        data
                    );
                    const serializedPayload = serialize(payload, {
                        type: PayloadDTO,
                    });
                    adapter.send(serializedPayload);
                    return E.right(undefined);
                })
            );
        },
    };
};

const typeToString = <T>(type: Type<T>): string => {
    const schema = getJsonSchema(type);
    return JSON.stringify(schema);
};
