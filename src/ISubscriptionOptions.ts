import ITimeoutStrategy from "./ITimeoutStrategy";
import IReconnectionStrategy from "./IReconnectionStrategy";

/**
 * Configuration options for GraphQL subscriptions.
 */
interface ISubscriptionOptions {
  /**
   * The timeout strategy to use for managing subscription timeouts and heartbeats.
   */
  timeoutStrategy?: ITimeoutStrategy | null;

  /**
   * The reconnection strategy to use for managing automatic reconnection attempts
   * after unexpected disconnections. This can be an IReconnectionStrategy instance
   * or a number representing a simple delay in milliseconds between reconnection attempts.
   */
  reconnectionStrategy?: IReconnectionStrategy | number | null;
}

export default ISubscriptionOptions;
