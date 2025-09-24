import ITimeoutApi from "./ITimeoutApi";
import IWebSocketMessage from "./IWebSocketMessage";
import ClientMsg from "./ClientMsg";
import CloseReason from "./CloseReason";

/**
 * Strategy interface for implementing timeout behavior in GraphQL subscriptions.
 * Timeout strategies can implement custom logic for handling connection timeouts,
 * heartbeats, ping/pong mechanisms, and other connection management features.
 *
 * This interface provides hooks into the subscription lifecycle, allowing strategies
 * to monitor and control the WebSocket connection state and message flow.
 */
interface ITimeoutStrategy {
  /**
   * Called immediately after the WebSocket is created but before the 'onopen' event fires.
   * This is where the strategy should initialize itself and store the API reference
   * for later use in controlling the subscription.
   *
   * @param api - The timeout API that provides methods to interact with the subscription
   */
  attach(api: ITimeoutApi): void;

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

export default ITimeoutStrategy;
