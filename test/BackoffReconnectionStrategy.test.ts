import BackoffReconnectionStrategy from "../src/BackoffReconnectionStrategy";
import CloseReason from "../src/CloseReason";

describe("BackoffReconnectionStrategy", () => {
  describe("constructor validation", () => {
    it("should throw error for negative initialDelayMs", () => {
      expect(() => new BackoffReconnectionStrategy(-1)).toThrow("initialDelayMs must be non-negative");
    });

    it("should throw error for maxDelayMs less than initialDelayMs", () => {
      expect(() => new BackoffReconnectionStrategy(1000, 500)).toThrow("maxDelayMs must be greater than or equal to initialDelayMs");
    });

    it("should throw error for backoffMultiplier <= 1", () => {
      expect(() => new BackoffReconnectionStrategy(1000, 5000, 1.0)).toThrow("backoffMultiplier must be greater than 1");
      expect(() => new BackoffReconnectionStrategy(1000, 5000, 0.5)).toThrow("backoffMultiplier must be greater than 1");
    });

    it("should throw error for negative maxAttempts", () => {
      expect(() => new BackoffReconnectionStrategy(1000, 5000, 2.0, -1)).toThrow("maxAttempts must be non-negative");
    });

    it("should accept valid parameters", () => {
      expect(() => new BackoffReconnectionStrategy(1000, 5000, 2.0, 5, true)).not.toThrow();
    });
  });

  describe("caching behavior", () => {
    it("should return same instance for identical configurations", () => {
      const strategy1 = new BackoffReconnectionStrategy(1000, 5000, 2.0, 5, true);
      const strategy2 = new BackoffReconnectionStrategy(1000, 5000, 2.0, 5, true);
      expect(strategy1).toBe(strategy2);
    });

    it("should return different instances for different configurations", () => {
      const strategy1 = new BackoffReconnectionStrategy(1000, 5000, 2.0, 5, true);
      const strategy2 = new BackoffReconnectionStrategy(2000, 5000, 2.0, 5, true);
      expect(strategy1).not.toBe(strategy2);
    });
  });

  describe("attach method", () => {
    it("should return a connection handler", () => {
      const strategy = new BackoffReconnectionStrategy();
      const handler = strategy.attach();
      expect(handler).toBeDefined();
      expect(typeof handler.onReconnectionAttempt).toBe("function");
    });

    it("should return different handler instances", () => {
      const strategy = new BackoffReconnectionStrategy();
      const handler1 = strategy.attach();
      const handler2 = strategy.attach();
      expect(handler1).not.toBe(handler2);
    });
  });

  describe("connection handler behavior", () => {
    let strategy: BackoffReconnectionStrategy;

    beforeEach(() => {
      strategy = new BackoffReconnectionStrategy(1000, 10000, 2.0, 5, false); // Disable jitter for predictable tests
    });

    it("should implement exponential backoff", () => {
      const handler = strategy.attach();

      // First attempt: 1000ms
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(1000);

      // Second attempt: 2000ms
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(2000);

      // Third attempt: 4000ms
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(4000);

      // Fourth attempt: 8000ms
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(8000);
    });

    it("should cap delay at maxDelayMs", () => {
      const shortMaxStrategy = new BackoffReconnectionStrategy(1000, 3000, 2.0, 10, false);
      const handler = shortMaxStrategy.attach();

      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(1000); // 1000
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(2000); // 2000
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(3000); // 4000 capped to 3000
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(3000); // 8000 capped to 3000
    });

    it("should stop reconnecting after maxAttempts", () => {
      const handler = strategy.attach();

      // Make 5 attempts (maxAttempts)
      for (let i = 0; i < 5; i++) {
        expect(handler.onReconnectionAttempt(CloseReason.Error)).toBeGreaterThan(0);
      }

      // 6th attempt should return -1 (stop reconnecting)
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(-1);
    });

    it("should allow unlimited attempts when maxAttempts is 0", () => {
      const unlimitedStrategy = new BackoffReconnectionStrategy(1000, 10000, 2.0, 0, false);
      const handler = unlimitedStrategy.attach();

      // Make many attempts - should never return -1
      for (let i = 0; i < 20; i++) {
        expect(handler.onReconnectionAttempt(CloseReason.Error)).toBeGreaterThan(0);
      }
    });

    it("should not reconnect for Server close reason", () => {
      const handler = strategy.attach();
      expect(handler.onReconnectionAttempt(CloseReason.Server)).toBe(-1);
    });

    it("should not reconnect for ServerError close reason", () => {
      const handler = strategy.attach();
      expect(handler.onReconnectionAttempt(CloseReason.ServerError)).toBe(-1);
    });

    it("should reconnect for other close reasons", () => {
      const handler = strategy.attach();
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBeGreaterThan(0);
      expect(handler.onReconnectionAttempt(CloseReason.Timeout)).toBeGreaterThan(0);
    });

    it("should reset attempt count on successful connection", () => {
      const handler = strategy.attach();

      // Make a few failed attempts
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(1000);
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(2000);

      // Simulate successful connection
      handler.onConnected?.();

      // Next attempt should start from initial delay again
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(1000);
    });

    it("should reset attempt count on close", () => {
      const handler = strategy.attach();

      // Make a few failed attempts
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(1000);
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(2000);

      // Simulate close
      handler.onClose?.();

      // Next attempt should start from initial delay again
      expect(handler.onReconnectionAttempt(CloseReason.Error)).toBe(1000);
    });
  });

  describe("jitter behavior", () => {
    it("should add jitter when enabled", () => {
      const strategy = new BackoffReconnectionStrategy(1000, 10000, 2.0, 5, true);

      // With jitter, delays should vary around the expected value
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        const handler = strategy.attach();
        delays.push(handler.onReconnectionAttempt(CloseReason.Error));
      }

      // All delays should be within the jitter range (750ms to 1250ms for ±25% jitter)
      delays.forEach((delay) => {
        expect(delay).toBeGreaterThanOrEqual(750);
        expect(delay).toBeLessThanOrEqual(1250);
      });

      // There should be variation in the delays
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it("should not add jitter when disabled", () => {
      const strategy = new BackoffReconnectionStrategy(1000, 10000, 2.0, 5, false);

      // Multiple handlers should return identical delays
      const delays: number[] = [];
      for (let i = 0; i < 5; i++) {
        const handler = strategy.attach();
        delays.push(handler.onReconnectionAttempt(CloseReason.Error));
      }

      // All delays should be exactly 1000ms
      delays.forEach((delay) => expect(delay).toBe(1000));
    });
  });

  describe("factory methods", () => {
    it("should create aggressive strategy", () => {
      const strategy = BackoffReconnectionStrategy.createAggressive();
      expect(strategy).toBeInstanceOf(BackoffReconnectionStrategy);

      const handler = strategy.attach();
      const delay = handler.onReconnectionAttempt(CloseReason.Error);
      expect(delay).toBeLessThan(1000); // Should be faster than default
    });

    it("should create conservative strategy", () => {
      const strategy = BackoffReconnectionStrategy.createConservative();
      expect(strategy).toBeInstanceOf(BackoffReconnectionStrategy);

      const handler = strategy.attach();
      const delay = handler.onReconnectionAttempt(CloseReason.Error);
      expect(delay).toBeGreaterThan(1000); // Should be slower than default
    });
  });

  describe("independent connection handlers", () => {
    it("should maintain independent state across multiple handlers", () => {
      const strategy = new BackoffReconnectionStrategy(1000, 10000, 2.0, 5, false);
      const handler1 = strategy.attach();
      const handler2 = strategy.attach();

      // Handler 1 makes attempts
      expect(handler1.onReconnectionAttempt(CloseReason.Error)).toBe(1000);
      expect(handler1.onReconnectionAttempt(CloseReason.Error)).toBe(2000);

      // Handler 2 should start fresh
      expect(handler2.onReconnectionAttempt(CloseReason.Error)).toBe(1000);
      expect(handler2.onReconnectionAttempt(CloseReason.Error)).toBe(2000);

      // Handler 1 continues from where it left off
      expect(handler1.onReconnectionAttempt(CloseReason.Error)).toBe(4000);
    });
  });
});
