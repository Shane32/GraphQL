import { useEffect, useState, useRef, useCallback } from "react";
import GraphQLClient from "./GraphQLClient";
import IQueryResult from "./IQueryResult";
import TypedDocumentString from "./TypedDocumentString";
import useSubscription from "./useSubscription";
import CloseReason from "./CloseReason";
import ISubscriptionOptions from "./ISubscriptionOptions";

/**
 * Represents the possible states of an auto-subscription.
 */
export enum AutoSubscriptionState {
  /** The subscription is not connected */
  Disconnected = "Disconnected",
  /** The subscription is in the process of connecting or reconnecting */
  Connecting = "Connecting",
  /** The subscription is connected and receiving data */
  Connected = "Connected",
}

/**
 * Represents the options for the useAutoSubscription hook.
 *
 * @template TResult The expected result type of the subscription.
 * @template TVariables The expected variables type of the subscription.
 */
export interface IUseAutoSubscriptionOptions<TResult, TVariables> extends ISubscriptionOptions {
  /** Whether to use the guest client. */
  guest?: boolean;
  /** The client to use for the subscription, or the name of the client. */
  client?: GraphQLClient | string;
  /**
   * The variables to use for the subscription, or a function that returns the variables.
   * Variables are evaluated each time the subscription is (re)connected.
   **/
  variables?: TVariables | (() => TVariables);
  /** The name of the operation to use for the subscription. */
  operationName?: string;
  /** Additional extensions to add to the subscription. */
  extensions?: {} | null;
  /** The callback function to invoke when new data is received. */
  onData?: (data: IQueryResult<TResult>) => void;
  /** The callback function to invoke when the subscription successfully connects. */
  onOpen?: () => void;
  /** The callback function to invoke when the subscription is closed. */
  onClose?: (reason: CloseReason) => void;
  /** Whether the subscription should be enabled (connected) or disabled (disconnected). Defaults to true. */
  enabled?: boolean;
}

/**
 * Represents the return value of the useAutoSubscription hook.
 */
export interface IUseAutoSubscriptionResult {
  /** The current state of the subscription. */
  state: AutoSubscriptionState;
}

/**
 * A hook that automatically manages a GraphQL subscription lifecycle.
 * The subscription is established when the component mounts (or when enabled becomes true)
 * and is automatically closed when the component unmounts (or when enabled becomes false).
 *
 * @template TResult The expected result type of the subscription.
 * @template TVariables The expected variables type of the subscription.
 * @param {string | TypedDocumentString<TResult, TVariables>} query The GraphQL subscription string or typed document.
 * @param {IUseAutoSubscriptionOptions<TResult, TVariables>} [options] The options for the auto-subscription.
 * @returns {IUseAutoSubscriptionResult} An object containing the current state of the subscription.
 */
const useAutoSubscription = <TResult, TVariables = unknown>(
  query: string | TypedDocumentString<TResult, TVariables>,
  options?: IUseAutoSubscriptionOptions<TResult, TVariables>,
): IUseAutoSubscriptionResult => {
  const [state, setState] = useState<AutoSubscriptionState>(AutoSubscriptionState.Disconnected);

  // Extract enabled flag, defaulting to true
  const enabled = options?.enabled !== false;

  // Store variables or variables function in a ref to always use the latest
  const variablesFnRef = useRef<(() => NonNullable<TVariables>) | undefined>();
  variablesFnRef.current =
    options?.variables && typeof options.variables === "function" ? (options.variables as () => NonNullable<TVariables>) : undefined;

  // Prepare options for useSubscription (without variables)
  const subscriptionOptions = {
    guest: options?.guest,
    client: options?.client,
    variables: options?.variables && typeof options.variables !== "function" ? options.variables : undefined,
    operationName: options?.operationName,
    extensions: options?.extensions,
    timeoutStrategy: options?.timeoutStrategy,
    onOpen: options?.onOpen,
    onData: options?.onData,
    onClose: options?.onClose,
  };

  // Use the underlying subscription hook
  const [subscribe] = useSubscription(query, subscriptionOptions);

  useEffect(() => {
    // If disabled, return early
    if (!enabled) {
      return;
    }

    let subscription = { connected: Promise.resolve(), abort: () => {} };

    const connect = () => {
      // Start connecting
      setState(AutoSubscriptionState.Connecting);

      // Execute the subscription
      subscription = subscribe({
        variables: variablesFnRef.current?.(),
        onOpen: () => {
          setState(AutoSubscriptionState.Connected);
        },
        onClose: (reason) => {
          if (reason !== CloseReason.Client) {
            // If not closed by us, try to reconnect
            connect();
          } else {
            setState(AutoSubscriptionState.Disconnected);
          }
        },
      });
    };

    return () => {
      subscription.abort();
    };
  }, [enabled, subscribe]);

  return { state };
};

export default useAutoSubscription;
