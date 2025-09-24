import ITimeoutStrategy from "./ITimeoutStrategy";

/**
 * Configuration options for GraphQL subscriptions.
 */
interface ISubscriptionOptions {
  /**
   * The timeout strategy to use for managing subscription timeouts and heartbeats.
   */
  timeoutStrategy?: ITimeoutStrategy;
}

export default ISubscriptionOptions;
