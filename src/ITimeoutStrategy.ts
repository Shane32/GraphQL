import ITimeoutApi from "./ITimeoutApi";
import ITimeoutConnectionHandler from "./ITimeoutConnectionHandler";

/**
 * Strategy interface for implementing timeout behavior in GraphQL subscriptions.
 * Timeout strategies can implement custom logic for handling connection timeouts,
 * heartbeats, ping/pong mechanisms, and other connection management features.
 *
 * This interface provides hooks into the subscription lifecycle, allowing strategies
 * to monitor and control the WebSocket connection state and message flow.
 *
 * The strategy can handle multiple connections by returning different handler instances
 * from the attach() method for each connection.
 */
interface ITimeoutStrategy {
  /**
   * Called immediately after the WebSocket is created but before the 'onopen' event fires.
   * This is where the strategy should create and return a connection-specific handler
   * that will manage the timeout behavior for this particular connection.
   *
   * @param api - The timeout API that provides methods to interact with the subscription
   * @returns A connection-specific handler that implements the timeout lifecycle hooks
   */
  attach(api: ITimeoutApi): ITimeoutConnectionHandler;
}

export default ITimeoutStrategy;
