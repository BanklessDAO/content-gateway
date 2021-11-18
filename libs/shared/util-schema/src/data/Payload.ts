import { SchemaInfo } from "..";

// * 💡 This type definition shouldn't be here, but otherwise TS would complain about
// * 💡 a circular type dependency, so we have to define it here. 😒

/**
 * Contains all the information that's necessary for Content Gateway
 * to save data.
 */
export type Payload<T> = {
    /**
     * Uniquely identifies the schema of the data.
     */
    info: SchemaInfo;
    /**
     * The cursor (id / timestamp / block time) that corresponds
     * to the data that is sent. If an array is sent set the cursor
     * using the last item in the array.
     */
    cursor: string;
    /**
     * The actual data that is being sent. This can also be an array.
     */
    data: T;
};
