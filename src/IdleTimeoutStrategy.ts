import ITimeoutStrategy from "./ITimeoutStrategy";
import ITimeoutConnectionHandler from "./ITimeoutConnectionHandler";
import ITimeoutApi from "./ITimeoutApi";
import IWebSocketMessage from "./IWebSocketMessage";
import CloseReason from "./CloseReason";

/**
 * Connection handler for IdleTimeoutStrategy that manages timeout state for a single connection.
 */
class IdleTimeoutConnectionHandler implements ITimeoutConnectionHandler {
  private timeoutId: number | null = null;

  constructor(
    private api: ITimeoutApi,
    private idleMs: number,
  ) {
    this.arm();
  }

  onOpen?(): void {
    this.arm();
  }

  onAck?(): void {
    this.arm();
  }

  onInbound?(msg: IWebSocketMessage<any>): boolean | void {
    this.arm();
  }

  onClose?(reason: CloseReason): void {
    this.disarm();
  }

  private arm(): void {
    this.disarm();
    this.timeoutId = window.setTimeout(() => {
      this.api.abort(CloseReason.Timeout);
    }, this.idleMs);
  }

  private disarm(): void {
    if (this.timeoutId !== null) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Simple idle timeout strategy that aborts the subscription if no inbound messages
 * are received within the specified timeout period.
 */
export default class IdleTimeoutStrategy implements ITimeoutStrategy {
  constructor(private idleMs: number) {}

  attach(api: ITimeoutApi): ITimeoutConnectionHandler {
    return new IdleTimeoutConnectionHandler(api, this.idleMs);
  }
}
