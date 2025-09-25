import CloseReason from "./CloseReason";

/**
 * Connection-specific reconnection handler returned by IReconnectionStrategy.attach().
 * This interface contains the lifecycle hooks for managing a single connection's
 * reconnection behavior. Each connection gets its own handler instance.
 */
interface IReconnectionConnectionHandler {
  /**
   * Called when attempting to reconnect after a previous connection failure.
   * This method is NOT called on the initial connection attempt, only on reconnection attempts.
   *
   * The handler should manage its own attempt counter and any other connection-specific state.
   *
   * @param reason - The reason the previous connection closed
   * @returns -1 to set Error state and stop reconnecting,
   *          0 to reconnect immediately,
   *          or positive number for delay in milliseconds before reconnecting
   */
  onReconnectionAttempt(reason: CloseReason): number;

  /**
   * Called when a connection is successfully established.
   * This allows the handler to reset its internal state (like attempt counters)
   * and prepare for potential future disconnections.
   */
  onConnected?(): void;

  /**
   * Called when the subscription is closing to allow cleanup of any resources.
   */
  onClose?(): void;
}

export default IReconnectionConnectionHandler;
