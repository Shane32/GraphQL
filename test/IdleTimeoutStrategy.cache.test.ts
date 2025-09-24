import IdleTimeoutStrategy from "../src/IdleTimeoutStrategy";

describe("IdleTimeoutStrategy Caching", () => {
  beforeEach(() => {
    // Clear any existing cache before each test
    (IdleTimeoutStrategy as any).cache.clear();
  });

  it("should return the same instance for the same timeout value", () => {
    const strategy1 = new IdleTimeoutStrategy(5000);
    const strategy2 = new IdleTimeoutStrategy(5000);

    expect(strategy1).toBe(strategy2);
  });

  it("should return different instances for different timeout values", () => {
    const strategy1 = new IdleTimeoutStrategy(5000);
    const strategy2 = new IdleTimeoutStrategy(10000);

    expect(strategy1).not.toBe(strategy2);
  });

  it("should cache multiple different timeout values", () => {
    const strategy1 = new IdleTimeoutStrategy(1000);
    const strategy2 = new IdleTimeoutStrategy(2000);
    const strategy3 = new IdleTimeoutStrategy(3000);

    // Create instances with same values again
    const strategy1Again = new IdleTimeoutStrategy(1000);
    const strategy2Again = new IdleTimeoutStrategy(2000);
    const strategy3Again = new IdleTimeoutStrategy(3000);

    expect(strategy1).toBe(strategy1Again);
    expect(strategy2).toBe(strategy2Again);
    expect(strategy3).toBe(strategy3Again);

    // All should be different from each other
    expect(strategy1).not.toBe(strategy2);
    expect(strategy2).not.toBe(strategy3);
    expect(strategy1).not.toBe(strategy3);
  });

  it("should work correctly with zero timeout", () => {
    const strategy1 = new IdleTimeoutStrategy(0);
    const strategy2 = new IdleTimeoutStrategy(0);

    expect(strategy1).toBe(strategy2);
  });

  it("should work correctly with very large timeout values", () => {
    const largeTimeout = Number.MAX_SAFE_INTEGER;
    const strategy1 = new IdleTimeoutStrategy(largeTimeout);
    const strategy2 = new IdleTimeoutStrategy(largeTimeout);

    expect(strategy1).toBe(strategy2);
  });

  it("should maintain functionality after caching", () => {
    const mockApi = {
      send: jest.fn(),
      abort: jest.fn(),
      request: { query: "test query" },
      subscriptionId: "test-id",
    } as any;

    const strategy1 = new IdleTimeoutStrategy(5000);
    const strategy2 = new IdleTimeoutStrategy(5000); // Should be cached

    expect(strategy1).toBe(strategy2);

    // Both should create working handlers
    const handler1 = strategy1.attach(mockApi);
    const handler2 = strategy2.attach(mockApi);

    expect(handler1).toBeDefined();
    expect(handler2).toBeDefined();
    expect(typeof handler1.onOpen).toBe("function");
    expect(typeof handler2.onOpen).toBe("function");
  });
});
