/**
 * Contains the data that's necessary for loading data.
 */
export type LoadContext = {
    /**
     * This is where we "left off" after the last loading. A cursor
     * is an opaque string that is usually a sequential id or a timestamp.
     */
    cursor?: string;
    /**
     * The number of items to load.
     */
    limit: number;
};

