import ITimeoutStrategy from "./ITimeoutStrategy";
import ITimeoutApi from "./ITimeoutApi";
import IWebSocketMessage from "./IWebSocketMessage";
import CloseReason from "./CloseReason";

/**
 * Correlated ping/pong timeout strategy that sends periodic pings and expects
 * matching pongs within a deadline. Aborts if pong is not received in time.
 */
export default class CorrelatedPingStrategy implements ITimeoutStrategy {
  private api!: ITimeoutApi;
  private intervalId: number | null = null;
  private deadlineId: number | null = null;
  private inFlight: string | null = null;

  constructor(
    private ackTimeoutMs: number,
    private pingIntervalMs: number,
    private pongDeadlineMs: number,
  ) {}

  attach(api: ITimeoutApi): void {
    this.api = api;
  }

  onOpen?(): void {
    // Start connection acknowledgment timeout
    this.deadlineId = window.setTimeout(() => {
      this.api.abort(CloseReason.Timeout);
    }, this.ackTimeoutMs);
  }

  onAck?(): void {
    this.start();
  }

  onInbound?(msg: IWebSocketMessage<any>): boolean | void {
    if (msg.type === "pong") {
      if (this.inFlight && msg.payload?.id === this.inFlight) {
        this.inFlight = null;
        this.clearDeadline();
        return false;
      }
    }
  }

  onClose?(reason: CloseReason): void {
    this.stop();
  }

  private start(): void {
    this.stop();
    this.intervalId = window.setInterval(() => this.sendPing(), this.pingIntervalMs);
  }

  private stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.clearDeadline();
    this.inFlight = null;
  }

  private sendPing(): void {
    if (this.inFlight) return; // wait for previous pong
    const id = Math.random().toString(36).slice(2);
    this.inFlight = id;
    this.api.send({ type: "ping", payload: { id } });
    this.armDeadline();
  }

  private armDeadline(): void {
    this.clearDeadline();
    this.deadlineId = window.setTimeout(() => {
      this.api.abort(CloseReason.Timeout);
    }, this.pongDeadlineMs);
  }

  private clearDeadline(): void {
    if (this.deadlineId !== null) {
      window.clearTimeout(this.deadlineId);
      this.deadlineId = null;
    }
  }
}
