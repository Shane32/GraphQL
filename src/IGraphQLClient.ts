import IGraphQLRequest from "./IGraphQLRequest";
import IQueryResponse from "./IQueryResponse";
import IQueryResult from "./IQueryResult";
import CloseReason from "./CloseReason";

/**
 * Represents a client for making GraphQL requests.
 */
interface IGraphQLClient {
  /**
   * Returns the number of pending requests.
   *
   * @returns The number of pending requests.
   */
  GetPendingRequests: () => number;

  /**
   * Returns the number of active subscriptions.
   *
   * @returns The number of active subscriptions.
   */
  GetActiveSubscriptions: () => number;

  /**
   * Executes a GraphQL query or mutation and returns a promise for the result; similar to the Fetch API. The caching layer is ignored; each call to this method will result in a new request to the server.
   *
   * This is commonly used for mutations where a specific user action should represent a distinct API call.
   *
   * @param request The GraphQL request to execute.
   * @returns An object containing a promise for the query result and a function to abort the request.
   */
  ExecuteQueryRaw: <TReturn, TVariables = undefined>(
    request: IGraphQLRequest<TVariables>,
  ) => { result: Promise<IQueryResult<TReturn>>; abort: () => void };

  /**
   * Executes a GraphQL query or mutation and returns an object that can be used to retrieve the response, monitor updates or abort it.
   *
   * Multiple calls for the same request may return the same response object depending on the specified cache mode to prevent identical requests from executing simultaneously.
   *
   * This is commonly used for queries for page data or other data that is expected to be reused.
   *
   * @param request The GraphQL request to execute.
   * @param cacheMode The cache mode to use for the query; uses the client's default cache mode when unspecified.
   * @param cacheTimeout The cache timeout to use for the query in milliseconds; uses the client's default cache timeout when unspecified.
   * @returns An object that can be used to retrieve the query response, monitor updates to it, or abort it.
   */
  ExecuteQuery: <TReturn, TVariables = undefined>(
    request: IGraphQLRequest<TVariables>,
    cacheMode?: "no-cache" | "cache-first" | "cache-and-network",
    cacheTimeout?: number,
  ) => IQueryResponse<TReturn>;

  /**
   * Executes a GraphQL subscription and returns a promise that resolves when the subscription is connected and a function to abort the subscription.
   *
   * @param request The GraphQL request to execute.
   * @param onData The callback function to invoke when new data is received.
   * @param onClose The callback function to invoke when the subscription is closed, including the reason for closure.
   * @returns An object containing a promise that resolves when the subscription is connected and a function to abort the subscription.
   */
  ExecuteSubscription: <TReturn, TVariables = undefined>(
    request: IGraphQLRequest<TVariables>,
    onData: (data: IQueryResult<TReturn>) => void,
    onClose: (reason: CloseReason) => void,
  ) => { connected: Promise<void>; abort: () => void };

  /**
   * Refreshes all cached queries in use and removes all other cache entries.  If force is true, aborts any loading queries and retries them.
   *
   * @param force If true, aborts any loading queries and retries them.
   */
  RefreshAll: (force?: boolean) => void;

  /**
   * Clears the cache but does not trigger a refresh for queries in use.  Expires remaining queries.
   */
  ClearCache: () => void;

  /**
   * Refreshes all cached queries in use and removes all other cache entries.  Any queries in use have their data cleared immediately.
   */
  ResetStore: () => void;
}

export default IGraphQLClient;
