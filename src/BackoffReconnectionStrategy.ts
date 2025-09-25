import IReconnectionStrategy from "./IReconnectionStrategy";
import IReconnectionConnectionHandler from "./IReconnectionConnectionHandler";
import CloseReason from "./CloseReason";

/**
 * Connection handler for BackoffReconnectionStrategy that manages exponential backoff reconnection state for a single connection.
 */
class BackoffReconnectionConnectionHandler implements IReconnectionConnectionHandler {
  private attemptCount = 0;

  constructor(
    private initialDelayMs: number,
    private maxDelayMs: number,
    private backoffMultiplier: number,
    private maxAttempts: number,
    private jitterEnabled: boolean,
  ) {}

  /**
   * Called when attempting to reconnect after a connection failure.
   * Implements exponential backoff with optional jitter.
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

    // Calculate exponential backoff delay
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, this.attemptCount - 1);

    // Cap the delay at maxDelayMs
    let delay = Math.min(exponentialDelay, this.maxDelayMs);

    // Add jitter if enabled (±25% random variation)
    if (this.jitterEnabled) {
      const jitterRange = delay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitter);
    }

    return Math.round(delay);
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
 * Exponential backoff reconnection strategy with configurable parameters.
 *
 * This strategy implements exponential backoff, where the delay between reconnection
 * attempts increases exponentially with each failed attempt. This helps reduce load
 * on servers during outages and provides better resilience for network issues.
 *
 * Features:
 * - Exponential backoff with configurable multiplier
 * - Maximum delay cap to prevent excessively long waits
 * - Optional jitter to prevent thundering herd problems
 * - Smart handling of different close reasons
 * - Self-caching for identical configurations
 *
 * Example delays with default settings (1000ms initial, 2x multiplier):
 * - Attempt 1: 1000ms
 * - Attempt 2: 2000ms
 * - Attempt 3: 4000ms
 * - Attempt 4: 8000ms
 * - Attempt 5: 16000ms (capped at maxDelayMs if lower)
 */
export default class BackoffReconnectionStrategy implements IReconnectionStrategy {
  private static cache = new Map<string, BackoffReconnectionStrategy>();

  /**
   * Creates a new BackoffReconnectionStrategy with the specified configuration.
   *
   * @param initialDelayMs - Initial delay in milliseconds for the first reconnection attempt (default: 1000)
   * @param maxDelayMs - Maximum delay in milliseconds to cap exponential growth (default: 30000)
   * @param backoffMultiplier - Multiplier for exponential backoff (default: 2.0)
   * @param maxAttempts - Maximum number of reconnection attempts before giving up (default: 10). Set to 0 for unlimited attempts.
   * @param jitterEnabled - Whether to add random jitter to delays to prevent thundering herd (default: true)
   */
  constructor(
    private initialDelayMs: number = 1000,
    private maxDelayMs: number = 30000,
    private backoffMultiplier: number = 2.0,
    private maxAttempts: number = 10,
    private jitterEnabled: boolean = true,
  ) {
    // Validate parameters
    if (initialDelayMs < 0) {
      throw new Error("initialDelayMs must be non-negative");
    }
    if (maxDelayMs < initialDelayMs) {
      throw new Error("maxDelayMs must be greater than or equal to initialDelayMs");
    }
    if (backoffMultiplier <= 1) {
      throw new Error("backoffMultiplier must be greater than 1");
    }
    if (maxAttempts < 0) {
      throw new Error("maxAttempts must be non-negative");
    }

    // Create cache key from parameters
    const cacheKey = `${initialDelayMs}-${maxDelayMs}-${backoffMultiplier}-${maxAttempts}-${jitterEnabled}`;

    // Check if we already have a cached instance for this configuration
    const cached = BackoffReconnectionStrategy.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache this instance
    BackoffReconnectionStrategy.cache.set(cacheKey, this);
  }

  /**
   * Creates a connection-specific handler for managing reconnection attempts.
   * Each connection gets its own handler instance with independent state.
   */
  attach(): IReconnectionConnectionHandler {
    return new BackoffReconnectionConnectionHandler(
      this.initialDelayMs,
      this.maxDelayMs,
      this.backoffMultiplier,
      this.maxAttempts,
      this.jitterEnabled,
    );
  }

  /**
   * Creates a BackoffReconnectionStrategy with aggressive settings for quick recovery.
   * Suitable for scenarios where fast reconnection is more important than server load.
   */
  static createAggressive(): BackoffReconnectionStrategy {
    return new BackoffReconnectionStrategy(500, 5000, 1.5, 15, true);
  }

  /**
   * Creates a BackoffReconnectionStrategy with conservative settings for server-friendly reconnection.
   * Suitable for scenarios where reducing server load is more important than quick recovery.
   */
  static createConservative(): BackoffReconnectionStrategy {
    return new BackoffReconnectionStrategy(2000, 60000, 2.5, 8, true);
  }
}
