import GraphQLClient from "./GraphQLClient";
import IQueryResult from "./IQueryResult";
import TypedDocumentString from "./TypedDocumentString";
import useGraphQLClient from "./useGraphQLClient";
import createRequest from "./createRequest";

/**
 * Represents the options for the subscription function returned by useSubscription.
 *
 * @template TVariables The expected variables type of the subscription.
 */
interface ISubscriptionFunctionOptions<TVariables> {
  /** The variables to use for the subscription. */
  variables?: TVariables;
  /** The callback function to invoke when new data is received. */
  onData?: (data: IQueryResult<any>) => void;
  /** The callback function to invoke when the subscription is closed. */
  onClose?: () => void;
}

/**
 * Represents the options for the useSubscription hook.
 *
 * @template TVariables The expected variables type of the subscription.
 */
interface IUseSubscriptionOptions<TVariables> {
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
  /** The callback function to invoke when new data is received. */
  onData?: (data: IQueryResult<any>) => void;
  /** The callback function to invoke when the subscription is closed. */
  onClose?: () => void;
}

/**
 * Represents the `useSubscription` hook.
 */
type IUseSubscription = <TResult, TVariables>(
  query: string | TypedDocumentString<TResult, TVariables>,
  options?: IUseSubscriptionOptions<TVariables>,
) => [(functionOptions?: ISubscriptionFunctionOptions<TVariables>) => { connected: Promise<void>; abort: () => void }];

/**
 * Returns a function that executes a GraphQL subscription.
 *
 * @template TResult The expected result type of the subscription.
 * @template TVariables The expected variables type of the subscription.
 * @param {string} query The GraphQL subscription string.
 * @param {IUseSubscriptionOptions<TVariables>} [options] The options for the subscription.
 * @returns {Array<Function>} A function that executes the subscription.
 */
const useSubscription: IUseSubscription = <TResult, TVariables>(
  query: string | TypedDocumentString<TResult, TVariables>,
  options?: IUseSubscriptionOptions<TVariables>,
) => {
  const client = useGraphQLClient(options && options.client, options && options.guest);

  /**
   * Executes the subscription with the specified options.
   *
   * @param {ISubscriptionFunctionOptions<TVariables>} [functionOptions] The options for the subscription execution.
   * @returns {{ connected: Promise<void>; abort: () => void }} An object containing a promise that resolves when the subscription is connected and a function to abort the subscription.
   */
  const executeSubscription = (functionOptions?: ISubscriptionFunctionOptions<TVariables>) => {
    const request = createRequest(query, {
      variables: (functionOptions?.variables || options?.variables) as any,
      operationName: options?.operationName,
      extensions: options?.extensions,
    });

    const onData = functionOptions?.onData || options?.onData || (() => {});
    const onClose = functionOptions?.onClose || options?.onClose || (() => {});

    return client.ExecuteSubscription<TResult, TVariables>(request, onData, onClose);
  };

  return [executeSubscription];
};

export default useSubscription;
