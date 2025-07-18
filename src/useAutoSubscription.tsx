import * as React from "react";
import GraphQLClient from "./GraphQLClient";
import IQueryResult from "./IQueryResult";
import TypedDocumentString from "./TypedDocumentString";
import useGraphQLClient from "./useGraphQLClient";
import createRequest from "./createRequest";

/**
 * Represents the return type of the `useAutoSubscription` hook.
 *
 * @template TResult The expected result type of the subscription.
 */
interface IUseAutoSubscriptionRet<TResult> {
  /** Whether the subscription is currently connected. */
  connected: boolean;
  /** Whether the subscription is currently connecting. */
  connecting: boolean;
  /** A function to manually abort the subscription. */
  abort: () => void;
  /** A function to manually reconnect the subscription. */
  reconnect: () => void;
}

/**
 * Represents the options for the `useAutoSubscription` hook.
 *
 * @template TResult The expected result type of the subscription.
 * @template TVariables The expected variables type of the subscription.
 */
interface IUseAutoSubscriptionOptions<TResult, TVariables> {
  /** Whether to use the guest client. */
  guest?: boolean;
  /** The client to use for the subscription, or the name of the client. */
  client?: GraphQLClient | string;
  /** The variables to use for the subscription. */
  variables?: TVariables;
  /** The name of the operation to use for the subscription. */
  operationName?: string;
  /** Additional extensions to add to the subscription. */
  extensions?: {} | null;
  /** Whether to skip execution of the subscription. */
  skip?: boolean;
  /** The callback function to invoke when new data is received. */
  onData?: (data: IQueryResult<TResult>) => void;
  /** The callback function to invoke when the subscription is closed. */
  onClose?: () => void;
}

/**
 * Automatically manages a GraphQL subscription, connecting when the component mounts
 * and disconnecting when it unmounts. Uses refs for event handlers to avoid
 * re-subscribing on each render.
 *
 * @template TResult The expected result type of the subscription.
 * @template TVariables The expected variables type of the subscription.
 * @param {string} query The GraphQL subscription string.
 * @param {IUseAutoSubscriptionOptions<TResult, TVariables>} [options] The options for the subscription.
 * @returns {IUseAutoSubscriptionRet<TResult>} The subscription state and control functions.
 */
const useAutoSubscription = <TResult, TVariables = unknown>(
  query: string | TypedDocumentString<TResult, TVariables>,
  options?: IUseAutoSubscriptionOptions<TResult, TVariables>,
): IUseAutoSubscriptionRet<TResult> => {
  const client = useGraphQLClient(options && options.client, options && options.guest);

  // Use refs for callbacks to avoid re-subscribing when they change
  const onDataRef = React.useRef(options?.onData);
  const onCloseRef = React.useRef(options?.onClose);

  // Update refs when callbacks change
  onDataRef.current = options?.onData;
  onCloseRef.current = options?.onClose;

  // State for subscription management
  const [connected, setConnected] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const abortRef = React.useRef<(() => void) | null>(null);

  // Memoize the request to avoid recreating it unnecessarily
  const request = React.useMemo(() => {
    if (options?.skip) return null;

    return createRequest(query, {
      variables: options?.variables as any,
      operationName: options?.operationName,
      extensions: options?.extensions,
    });
  }, [
    query,
    JSON.stringify(options?.variables || null),
    options?.operationName,
    JSON.stringify(options?.extensions || null),
    options?.skip,
  ]);

  // Function to start the subscription
  const startSubscription = React.useCallback(() => {
    if (!request) return;

    setConnecting(true);
    setConnected(false);

    const { connected: connectedPromise, abort } = client.ExecuteSubscription<TResult, TVariables>(
      request,
      (result) => {
        onDataRef.current?.(result);
      },
      () => {
        setConnected(false);
        setConnecting(false);
        onCloseRef.current?.();
      },
    );

    abortRef.current = abort;

    connectedPromise
      .then(() => {
        setConnected(true);
        setConnecting(false);
      })
      .catch(() => {
        setConnected(false);
        setConnecting(false);
      });
  }, [client, request]);

  // Function to abort the subscription
  const abort = React.useCallback(() => {
    abortRef.current?.();
  }, []);

  // Function to reconnect the subscription
  const reconnect = React.useCallback(() => {
    if (connected) return;
    startSubscription();
  }, [connected, startSubscription]);

  // Auto-connect when the hook mounts or dependencies change
  React.useEffect(() => {
    if (!options?.skip) {
      startSubscription();
    }

    // Cleanup on unmount or dependency change
    return () => {
      abort();
    };
  }, [startSubscription, options?.skip]);

  // Handle skip changes
  React.useEffect(() => {
    if (options?.skip) {
      abort();
    }
  }, [options?.skip, abort]);

  return {
    connected,
    connecting,
    abort,
    reconnect,
  };
};

export default useAutoSubscription;
