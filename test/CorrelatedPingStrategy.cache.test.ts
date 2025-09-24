import CorrelatedPingStrategy from "../src/CorrelatedPingStrategy";

describe("CorrelatedPingStrategy Caching", () => {
  beforeEach(() => {
    // Clear any existing cache before each test
    (CorrelatedPingStrategy as any).cache.clear();
  });

  it("should return the same instance for identical parameters", () => {
    const strategy1 = new CorrelatedPingStrategy(3000, 5000, 2000);
    const strategy2 = new CorrelatedPingStrategy(3000, 5000, 2000);

    expect(strategy1).toBe(strategy2);
  });

  it("should return different instances for different ackTimeoutMs", () => {
    const strategy1 = new CorrelatedPingStrategy(3000, 5000, 2000);
    const strategy2 = new CorrelatedPingStrategy(4000, 5000, 2000);

    expect(strategy1).not.toBe(strategy2);
  });

  it("should return different instances for different pingIntervalMs", () => {
    const strategy1 = new CorrelatedPingStrategy(3000, 5000, 2000);
    const strategy2 = new CorrelatedPingStrategy(3000, 6000, 2000);

    expect(strategy1).not.toBe(strategy2);
  });

  it("should return different instances for different pongDeadlineMs", () => {
    const strategy1 = new CorrelatedPingStrategy(3000, 5000, 2000);
    const strategy2 = new CorrelatedPingStrategy(3000, 5000, 3000);

    expect(strategy1).not.toBe(strategy2);
  });

  it("should cache multiple different parameter combinations", () => {
    const strategy1 = new CorrelatedPingStrategy(1000, 2000, 3000);
    const strategy2 = new CorrelatedPingStrategy(4000, 5000, 6000);
    const strategy3 = new CorrelatedPingStrategy(7000, 8000, 9000);

    // Create instances with same values again
    const strategy1Again = new CorrelatedPingStrategy(1000, 2000, 3000);
    const strategy2Again = new CorrelatedPingStrategy(4000, 5000, 6000);
    const strategy3Again = new CorrelatedPingStrategy(7000, 8000, 9000);

    expect(strategy1).toBe(strategy1Again);
    expect(strategy2).toBe(strategy2Again);
    expect(strategy3).toBe(strategy3Again);

    // All should be different from each other
    expect(strategy1).not.toBe(strategy2);
    expect(strategy2).not.toBe(strategy3);
    expect(strategy1).not.toBe(strategy3);
  });

  it("should work correctly with zero timeouts", () => {
    const strategy1 = new CorrelatedPingStrategy(0, 0, 0);
    const strategy2 = new CorrelatedPingStrategy(0, 0, 0);

    expect(strategy1).toBe(strategy2);
  });

  it("should work correctly with very large timeout values", () => {
    const largeTimeout = Number.MAX_SAFE_INTEGER;
    const strategy1 = new CorrelatedPingStrategy(largeTimeout, largeTimeout, largeTimeout);
    const strategy2 = new CorrelatedPingStrategy(largeTimeout, largeTimeout, largeTimeout);

    expect(strategy1).toBe(strategy2);
  });

  it("should handle mixed parameter combinations correctly", () => {
    // Test various combinations that might be used in practice
    const combinations = [
      [100, 500, 200],
      [200, 100, 50],
      [200, 300, 200],
      [200, 500, 300],
      [200, 80, 100],
    ];

    const strategies: CorrelatedPingStrategy[] = [];

    // Create strategies for each combination
    combinations.forEach(([ack, ping, pong]) => {
      strategies.push(new CorrelatedPingStrategy(ack, ping, pong));
    });

    // Create the same combinations again and verify caching
    combinations.forEach(([ack, ping, pong], index) => {
      const cachedStrategy = new CorrelatedPingStrategy(ack, ping, pong);
      expect(cachedStrategy).toBe(strategies[index]);
    });

    // Verify all strategies are different from each other
    for (let i = 0; i < strategies.length; i++) {
      for (let j = i + 1; j < strategies.length; j++) {
        expect(strategies[i]).not.toBe(strategies[j]);
      }
    }
  });

  it("should maintain functionality after caching", () => {
    const mockApi = {
      send: jest.fn(),
      abort: jest.fn(),
      request: { query: "test query" },
      subscriptionId: "test-id",
    } as any;

    const strategy1 = new CorrelatedPingStrategy(3000, 5000, 2000);
    const strategy2 = new CorrelatedPingStrategy(3000, 5000, 2000); // Should be cached

    expect(strategy1).toBe(strategy2);

    // Both should create working handlers
    const handler1 = strategy1.attach(mockApi);
    const handler2 = strategy2.attach(mockApi);

    expect(handler1).toBeDefined();
    expect(handler2).toBeDefined();
    expect(typeof handler1.onOpen).toBe("function");
    expect(typeof handler2.onOpen).toBe("function");
    expect(typeof handler1.onAck).toBe("function");
    expect(typeof handler2.onAck).toBe("function");
    expect(typeof handler1.onInbound).toBe("function");
    expect(typeof handler2.onInbound).toBe("function");
    expect(typeof handler1.onClose).toBe("function");
    expect(typeof handler2.onClose).toBe("function");
  });

  it("should handle edge case where parameters could create ambiguous keys", () => {
    // Test cases where naive string concatenation might cause issues
    const strategy1 = new CorrelatedPingStrategy(12, 34, 56);
    const strategy2 = new CorrelatedPingStrategy(123, 4, 56);
    const strategy3 = new CorrelatedPingStrategy(1, 234, 56);

    // All should be different instances
    expect(strategy1).not.toBe(strategy2);
    expect(strategy2).not.toBe(strategy3);
    expect(strategy1).not.toBe(strategy3);

    // But same parameters should return same instance
    const strategy1Again = new CorrelatedPingStrategy(12, 34, 56);
    const strategy2Again = new CorrelatedPingStrategy(123, 4, 56);
    const strategy3Again = new CorrelatedPingStrategy(1, 234, 56);

    expect(strategy1).toBe(strategy1Again);
    expect(strategy2).toBe(strategy2Again);
    expect(strategy3).toBe(strategy3Again);
  });
});
