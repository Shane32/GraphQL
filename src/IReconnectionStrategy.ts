import IReconnectionConnectionHandler from "./IReconnectionConnectionHandler";

/**
 * Strategy interface for implementing reconnection behavior in GraphQL subscriptions.
 * Reconnection strategies control when and how subscriptions should reconnect after
 * unexpected disconnections.
 *
 * This interface provides a factory method to create connection-specific handlers
 * that manage reconnection state for individual subscription connections.
 *
 * The strategy can handle multiple connections by returning different handler instances
 * from the attach() method for each connection.
 */
interface IReconnectionStrategy {
  /**
   * Called when a subscription connection is established to create a connection-specific
   * reconnection handler. Each connection gets its own handler instance to manage
   * its reconnection state independently.
   *
   * @returns A connection-specific handler that implements the reconnection lifecycle
   */
  attach(): IReconnectionConnectionHandler;
}

export default IReconnectionStrategy;
