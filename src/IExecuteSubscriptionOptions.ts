import ISubscriptionOptions from "./ISubscriptionOptions";

/**
 * Configuration options for GraphQL subscriptions with callback support.
 */
interface IExecuteSubscriptionOptions extends ISubscriptionOptions {
  /**
   * The callback function to invoke when the subscription connection is opened.
   */
  onOpen?: () => void;
}

export default IExecuteSubscriptionOptions;
