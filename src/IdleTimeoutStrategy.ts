import ITimeoutStrategy from "./ITimeoutStrategy";
import ITimeoutApi from "./ITimeoutApi";
import IWebSocketMessage from "./IWebSocketMessage";
import CloseReason from "./CloseReason";

/**
 * Simple idle timeout strategy that aborts the subscription if no inbound messages
 * are received within the specified timeout period.
 */
export default class IdleTimeoutStrategy implements ITimeoutStrategy {
  private api!: ITimeoutApi;
  private idleMs: number;
  private timeoutId: number | null = null;

  constructor(idleMs: number) {
    this.idleMs = idleMs;
  }

  attach(api: ITimeoutApi): void {
    this.api = api;
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
