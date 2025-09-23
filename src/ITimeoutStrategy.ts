import ITimeoutApi from "./ITimeoutApi";
import IWebSocketMessage from "./IWebSocketMessage";
import ClientMsg from "./ClientMsg";
import CloseReason from "./CloseReason";

/**
 * Strategy interface for implementing timeout behavior
 */
interface ITimeoutStrategy {
  /** Called right after socket is created and before onopen fires. */
  attach(api: ITimeoutApi): void;

  /** Socket open (we just sent/are about to send connection_init). */
  onOpen?(): void;

  /** After connection_ack and subscribe sent. Start heartbeats here. */
  onAck?(): void;

  /**
   * Observe each inbound server frame (already parsed).
   * Return false to consume (prevent core from handling).
   * Return true/void to let core continue.
   */
  onInbound?(msg: IWebSocketMessage<any>): boolean | void;

  /** Called for each outbound client frame (after being sent). */
  onOutbound?(msg: ClientMsg): void;

  /** Called when the subscription is closing/closed for cleanup. */
  onClose?(reason: CloseReason): void;
}

export default ITimeoutStrategy;
