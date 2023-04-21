import IQueryResult from "./IQueryResult";

/**
 * Represents a GraphQL query within the cache layer (applicable even if caching is not used for this query).
 *
 * @template T The type of the query result.
 */
interface IQueryResponse<T> {
    /**
     * A promise for the query result.  The promise is resolved when the query completes, either immediately or in the future.  Errors are returned as a result; it will never reject.
     */
    resultPromise: Promise<IQueryResult<T>>;

    /**
     * Indicates whether the query is currently loading.
     */
    loading: boolean;

    /**
     * The result of the query, or null if the query has not yet completed.
     */
    result: IQueryResult<T> | null;

    /**
     * Subscribes to updates for the query result; execute the returned function to discontinue update notification.
     *
     * Note that updates only typically occur if the cache mode is set to cache-first or cache-and-network and ExecuteQuery is called again.  This subscription is not tied to the server and there is no automatic refresh mechanism.
     *
     * @param callback A callback function to be invoked when the query result changes.
     * @returns A function to release the subscription.
     */
    subscribe: (callback: (result: IQueryResult<T> | null) => void) => () => void;

    /**
     * Refreshes the query and returns a promise for the new result.  If the query is currently loading, nothing happens.
     *
     * @returns A promise for the new query result.
     */
    refresh: () => Promise<IQueryResult<T>>;

    /**
     * Forces a refresh of the query.  If the query is currently loading, the request is aborted and retried.
     */
    forceRefresh: () => void;

    /**
     * Forces a refresh of the query.  If the query is currently loading, the request is aborted and retried.  Any "subscriptions" to this query are cleared of data.
     */
    clearAndRefresh: () => void;
}

export default IQueryResponse;
