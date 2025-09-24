import ITimeoutStrategy from "./ITimeoutStrategy";
import ITimeoutConnectionHandler from "./ITimeoutConnectionHandler";
import ITimeoutApi from "./ITimeoutApi";
import IWebSocketMessage from "./IWebSocketMessage";
import CloseReason from "./CloseReason";

/**
 * Connection handler for CorrelatedPingStrategy that manages ping/pong state for a single connection.
 */
class CorrelatedPingConnectionHandler implements ITimeoutConnectionHandler {
  private intervalId: number | null = null;
  private deadlineId: number | null = null;
  private inFlight: string | null = null;

  constructor(
    private api: ITimeoutApi,
    private ackTimeoutMs: number,
    private pingIntervalMs: number,
    private pongDeadlineMs: number,
  ) {}

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

/**
 * Correlated ping/pong timeout strategy that sends periodic pings and expects
 * matching pongs within a deadline. Aborts if pong is not received in time.
 */
export default class CorrelatedPingStrategy implements ITimeoutStrategy {
  private static cache = new Map<string, CorrelatedPingStrategy>();

  constructor(ackTimeoutMs: number, pingIntervalMs: number, pongDeadlineMs: number) {
    // Initialize the instance
    this.ackTimeoutMs = ackTimeoutMs;
    this.pingIntervalMs = pingIntervalMs;
    this.pongDeadlineMs = pongDeadlineMs;

    // Create a composite key from all three parameters
    const cacheKey = `${ackTimeoutMs}:${pingIntervalMs}:${pongDeadlineMs}`;

    // Check if we already have a cached instance for this combination
    const cached = CorrelatedPingStrategy.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache this instance
    CorrelatedPingStrategy.cache.set(cacheKey, this);
  }

  private ackTimeoutMs: number;
  private pingIntervalMs: number;
  private pongDeadlineMs: number;

  attach(api: ITimeoutApi): ITimeoutConnectionHandler {
    return new CorrelatedPingConnectionHandler(api, this.ackTimeoutMs, this.pingIntervalMs, this.pongDeadlineMs);
  }
}
