import IReconnectionStrategy from "./IReconnectionStrategy";
import IReconnectionConnectionHandler from "./IReconnectionConnectionHandler";
import CloseReason from "./CloseReason";

/**
 * Connection handler for DelayedReconnectionStrategy that manages reconnection state for a single connection.
 */
class DelayedReconnectionConnectionHandler implements IReconnectionConnectionHandler {
  private attemptCount = 0;

  constructor(
    private delayMs: number,
    private maxAttempts: number,
  ) {}

  /**
   * Called when attempting to reconnect after a connection failure.
   * Increments the attempt counter and determines the reconnection behavior.
   */
  onReconnectionAttempt(reason: CloseReason): number {
    if (reason === CloseReason.Server || reason === CloseReason.ServerError) {
      return -1; // Don't reconnect for server-initiated closures
    }

    this.attemptCount++;

    // If maxAttempts is 0, allow unlimited attempts
    if (this.maxAttempts > 0 && this.attemptCount > this.maxAttempts) {
      return -1; // Stop reconnecting, set Error state
    }

    return this.delayMs; // Wait before reconnecting
  }

  /**
   * Called when a connection is successfully established.
   * Resets the attempt counter to prepare for future disconnections.
   */
  onConnected(): void {
    this.attemptCount = 0;
  }

  /**
   * Called when the subscription is closing.
   * Resets the attempt counter to clean up state.
   */
  onClose(): void {
    this.attemptCount = 0;
  }
}

/**
 * Basic reconnection strategy with configurable delay and maximum attempts.
 *
 * This strategy waits a fixed delay between reconnection attempts and stops
 * reconnecting after a maximum number of attempts. The attempt counter is
 * reset when a connection is successfully established.
 *
 * Uses self-caching to ensure the same instance is returned for identical configurations.
 */
export default class DelayedReconnectionStrategy implements IReconnectionStrategy {
  private static cache = new Map<string, DelayedReconnectionStrategy>();

  /**
   * Creates a new DelayedReconnectionStrategy with the specified configuration.
   *
   * @param delayMs - Delay in milliseconds between reconnection attempts (default: 5000)
   * @param maxAttempts - Maximum number of reconnection attempts before giving up (default: 5). Set to 0 for unlimited attempts.
   */
  constructor(
    private delayMs: number = 5000,
    private maxAttempts: number = 5,
  ) {
    // Create cache key from parameters
    const cacheKey = `${delayMs}-${maxAttempts}`;

    // Check if we already have a cached instance for this configuration
    const cached = DelayedReconnectionStrategy.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache this instance
    DelayedReconnectionStrategy.cache.set(cacheKey, this);
  }

  /**
   * Creates a connection-specific handler for managing reconnection attempts.
   * Each connection gets its own handler instance with independent state.
   */
  attach(): IReconnectionConnectionHandler {
    return new DelayedReconnectionConnectionHandler(this.delayMs, this.maxAttempts);
  }
}
