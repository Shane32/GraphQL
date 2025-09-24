import IWebSocketMessage from "./IWebSocketMessage";
import ClientMsg from "./ClientMsg";
import CloseReason from "./CloseReason";

/**
 * Connection-specific timeout handler returned by ITimeoutStrategy.attach().
 * This interface contains all the lifecycle hooks for managing a single connection's
 * timeout behavior. Each connection gets its own handler instance.
 */
interface ITimeoutConnectionHandler {
  /**
   * Called when the WebSocket connection opens, immediately before sending the connection_init
   * message to the server. The WebSocket is open but the GraphQL connection handshake
   * has not yet begun.
   *
   * Optional hook for strategies that need to perform actions when the connection opens.
   */
  onOpen?(): void;

  /**
   * Called after receiving connection_ack from the server but before sending the subscribe message.
   * This is typically where heartbeat mechanisms should be started, as the connection
   * handshake is complete and the subscription is about to begin.
   *
   * Optional hook for strategies that need to start periodic tasks after connection establishment.
   */
  onAck?(): void;

  /**
   * Called for each inbound message received from the server (after JSON parsing).
   * Strategies can observe or intercept messages before the core client processes them.
   *
   * @param msg - The parsed WebSocket message from the server
   * @returns false to consume the message (prevent core from handling it),
   *          true or void to allow core processing to continue
   */
  onInbound?(msg: IWebSocketMessage<any>): boolean | void;

  /**
   * Called for each outbound message sent to the server (after it has been sent).
   * This includes messages sent by the core client as well as messages sent
   * via the ITimeoutApi.send() method by the strategy itself.
   * This allows strategies to observe what messages are being sent for logging,
   * timing, or other monitoring purposes.
   *
   * @param msg - The client message that was sent to the server
   */
  onOutbound?(msg: ClientMsg): void;

  /**
   * Called when the subscription is closing or has closed. This is where strategies
   * should perform cleanup operations such as clearing timers, canceling intervals,
   * or releasing other resources.
   *
   * @param reason - The reason why the subscription is closing
   */
  onClose?(reason: CloseReason): void;
}

export default ITimeoutConnectionHandler;
