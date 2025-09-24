import IdleTimeoutStrategy from "../src/IdleTimeoutStrategy";
import ITimeoutApi from "../src/ITimeoutApi";
import CloseReason from "../src/CloseReason";
import IWebSocketMessage from "../src/IWebSocketMessage";

describe("IdleTimeoutStrategy", () => {
  let strategy: IdleTimeoutStrategy;
  let mockApi: jest.Mocked<ITimeoutApi>;
  let mockSetTimeout: jest.SpyInstance;
  let mockClearTimeout: jest.SpyInstance;

  beforeEach(() => {
    // Mock window.setTimeout and window.clearTimeout
    mockSetTimeout = jest.spyOn(window, "setTimeout");
    mockClearTimeout = jest.spyOn(window, "clearTimeout");

    // Create mock API
    mockApi = {
      send: jest.fn(),
      abort: jest.fn(),
      request: { query: "test query" },
      subscriptionId: "test-id",
    } as any;

    strategy = new IdleTimeoutStrategy(5000); // 5 second timeout
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe("attach", () => {
    it("should store the API reference and arm the timeout", () => {
      strategy.attach(mockApi);

      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 5000);
    });
  });

  describe("timeout behavior", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      strategy.attach(mockApi);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should abort with timeout reason when idle timeout expires", () => {
      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(5000);

      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should not abort if timeout has not expired", () => {
      // Fast-forward time but not enough to trigger timeout
      jest.advanceTimersByTime(4999);

      expect(mockApi.abort).not.toHaveBeenCalled();
    });

    it("should reset timeout on onOpen", () => {
      // Let some time pass
      jest.advanceTimersByTime(3000);

      // Call onOpen to reset timeout
      strategy.onOpen?.();

      // Fast-forward by less than the full timeout - should not abort yet
      jest.advanceTimersByTime(4999);
      expect(mockApi.abort).not.toHaveBeenCalled();

      // Fast-forward by remaining time to complete new timeout
      jest.advanceTimersByTime(1);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should reset timeout on onAck", () => {
      // Let some time pass
      jest.advanceTimersByTime(3000);

      // Call onAck to reset timeout
      strategy.onAck?.();

      // Fast-forward by less than the full timeout - should not abort yet
      jest.advanceTimersByTime(4999);
      expect(mockApi.abort).not.toHaveBeenCalled();

      // Fast-forward by remaining time to complete new timeout
      jest.advanceTimersByTime(1);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should reset timeout on inbound message", () => {
      const message: IWebSocketMessage<any> = {
        type: "next",
        id: "test-id",
        payload: { data: { test: "data" } },
      };

      // Let some time pass
      jest.advanceTimersByTime(3000);

      // Call onInbound to reset timeout
      strategy.onInbound?.(message);

      // Fast-forward by less than the full timeout - should not abort yet
      jest.advanceTimersByTime(4999);
      expect(mockApi.abort).not.toHaveBeenCalled();

      // Fast-forward by remaining time to complete new timeout
      jest.advanceTimersByTime(1);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should clear timeout on close", () => {
      // Call onClose
      strategy.onClose?.(CloseReason.Client);

      // Fast-forward time - should not abort since timeout was cleared
      jest.advanceTimersByTime(10000);
      expect(mockApi.abort).not.toHaveBeenCalled();
    });

    it("should handle multiple arm/disarm cycles correctly", () => {
      // Reset timeout multiple times
      strategy.onOpen?.();
      strategy.onAck?.();
      strategy.onInbound?.({ type: "ping" });

      // Should still timeout after the last reset
      jest.advanceTimersByTime(5000);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });
  });

  describe("edge cases", () => {
    it("should handle zero timeout", () => {
      jest.useFakeTimers();
      const zeroTimeoutStrategy = new IdleTimeoutStrategy(0);
      zeroTimeoutStrategy.attach(mockApi);

      // Should timeout immediately
      jest.advanceTimersByTime(0);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);

      jest.useRealTimers();
    });

    it("should handle very large timeout", () => {
      jest.useFakeTimers();
      const largeTimeoutStrategy = new IdleTimeoutStrategy(1000000);
      largeTimeoutStrategy.attach(mockApi);

      // Should not timeout for a reasonable amount of time
      jest.advanceTimersByTime(999999);
      expect(mockApi.abort).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("should not crash if onInbound is called with null message", () => {
      strategy.attach(mockApi);
      // The strategy doesn't actually check the message content, just calls arm()
      expect(() => strategy.onInbound?.(null as any)).not.toThrow();
    });

    it("should not crash if methods are called before attach", () => {
      const unattachedStrategy = new IdleTimeoutStrategy(5000);
      expect(() => unattachedStrategy.onOpen?.()).not.toThrow();
      expect(() => unattachedStrategy.onAck?.()).not.toThrow();
      expect(() => unattachedStrategy.onInbound?.({ type: "ping" })).not.toThrow();
      expect(() => unattachedStrategy.onClose?.(CloseReason.Client)).not.toThrow();
    });
  });
});
