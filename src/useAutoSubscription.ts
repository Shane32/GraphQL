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
  /** The subscription is in the process of connecting */
  Connecting = "Connecting",
  /** The subscription is connected and receiving data */
  Connected = "Connected",
  /** The subscription encountered an error */
  Error = "Error",
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
  const abortRef = useRef<(() => void) | null>(null);
  const isConnectingRef = useRef(false);

  // Extract enabled flag, defaulting to true
  const enabled = options?.enabled !== false;

  // Store variables or variables function in a ref to always use the latest
  const variablesRef = useRef(options?.variables);
  variablesRef.current = options?.variables;

  // Store onOpen handler in a ref to always use the latest
  const onOpenRef = useRef(options?.onOpen);
  onOpenRef.current = options?.onOpen;

  // Prepare options for useSubscription (without variables)
  const subscriptionOptions = {
    guest: options?.guest,
    client: options?.client,
    operationName: options?.operationName,
    extensions: options?.extensions,
    timeoutStrategy: options?.timeoutStrategy,
    onData: options?.onData,
    onClose: (reason: CloseReason) => {
      // Update state based on close reason
      if (reason === CloseReason.Error || reason === CloseReason.Timeout) {
        setState(AutoSubscriptionState.Error);
      } else {
        setState(AutoSubscriptionState.Disconnected);
      }

      // Clean up our tracking
      isConnectingRef.current = false;
      abortRef.current = null;

      // Call user's onClose handler
      options?.onClose?.(reason);
    },
  };

  // Use the underlying subscription hook
  const [subscribe] = useSubscription(query, subscriptionOptions);

  useEffect(() => {
    // If disabled, disconnect and return early
    if (!enabled) {
      if (abortRef.current) {
        abortRef.current();
        abortRef.current = null;
        isConnectingRef.current = false;
      }
      setState(AutoSubscriptionState.Disconnected);
      return;
    }

    // Prevent duplicate connection attempts
    if (isConnectingRef.current || abortRef.current) {
      return;
    }

    // Start connecting
    isConnectingRef.current = true;
    setState(AutoSubscriptionState.Connecting);

    // Resolve variables if they're a function
    const getVariables = () => {
      const vars = variablesRef.current;
      if (typeof vars === "function") {
        return (vars as () => TVariables)();
      }
      return vars as TVariables | undefined;
    };

    // Execute the subscription
    const subscription = subscribe({
      variables: getVariables(),
    });

    // Store abort function
    abortRef.current = subscription.abort;

    // Handle connection promise
    subscription.connected
      .then(() => {
        // Only update state if we're still the active subscription
        if (isConnectingRef.current && abortRef.current === subscription.abort) {
          setState(AutoSubscriptionState.Connected);
          // Call onOpen handler when successfully connected
          onOpenRef.current?.();
        }
      })
      .catch((error) => {
        // Only update state if we're still the active subscription
        if (isConnectingRef.current && abortRef.current === subscription.abort) {
          setState(AutoSubscriptionState.Error);
          console.error("Failed to connect subscription:", error);
        }
      })
      .finally(() => {
        isConnectingRef.current = false;
      });

    // Cleanup function
    return () => {
      if (abortRef.current === subscription.abort) {
        subscription.abort();
        abortRef.current = null;
        isConnectingRef.current = false;
      }
    };
  }, [enabled, subscribe]);

  return { state };
};

export default useAutoSubscription;
