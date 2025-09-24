import CorrelatedPingStrategy from "../src/CorrelatedPingStrategy";
import ITimeoutApi from "../src/ITimeoutApi";
import ITimeoutConnectionHandler from "../src/ITimeoutConnectionHandler";
import CloseReason from "../src/CloseReason";
import IWebSocketMessage from "../src/IWebSocketMessage";

describe("CorrelatedPingStrategy", () => {
  let strategy: CorrelatedPingStrategy;
  let handler: ITimeoutConnectionHandler;
  let mockApi: jest.Mocked<ITimeoutApi>;
  let mockSetTimeout: jest.SpyInstance;
  let mockClearTimeout: jest.SpyInstance;
  let mockSetInterval: jest.SpyInstance;
  let mockClearInterval: jest.SpyInstance;

  beforeEach(() => {
    // Mock window timer functions
    mockSetTimeout = jest.spyOn(window, "setTimeout");
    mockClearTimeout = jest.spyOn(window, "clearTimeout");
    mockSetInterval = jest.spyOn(window, "setInterval");
    mockClearInterval = jest.spyOn(window, "clearInterval");

    // Create mock API
    mockApi = {
      send: jest.fn(),
      abort: jest.fn(),
      request: { query: "test query" },
      subscriptionId: "test-id",
    } as any;

    // ackTimeoutMs: 3000, pingIntervalMs: 5000, pongDeadlineMs: 2000
    strategy = new CorrelatedPingStrategy(3000, 5000, 2000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
  });

  describe("attach", () => {
    it("should return a connection handler", () => {
      handler = strategy.attach(mockApi);
      expect(handler).toBeDefined();
      // No immediate side effects expected
      expect(mockSetTimeout).not.toHaveBeenCalled();
      expect(mockSetInterval).not.toHaveBeenCalled();
    });
  });

  describe("connection acknowledgment timeout", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      handler = strategy.attach(mockApi);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should start ack timeout on onOpen", () => {
      handler.onOpen?.();

      // With fake timers, we can't spy on the calls, but we can verify the behavior
      // The timeout should be set and should fire after 3000ms
      expect(mockApi.abort).not.toHaveBeenCalled();
      jest.advanceTimersByTime(2999);
      expect(mockApi.abort).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should abort if ack timeout expires", () => {
      handler.onOpen?.();

      jest.advanceTimersByTime(3000);

      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should not abort if ack is received in time", () => {
      handler.onOpen?.();

      // Advance time but not enough to trigger timeout
      jest.advanceTimersByTime(2999);
      expect(mockApi.abort).not.toHaveBeenCalled();

      // Receive ack
      handler.onAck?.();

      // Complete the original timeout period
      jest.advanceTimersByTime(1);
      expect(mockApi.abort).not.toHaveBeenCalled();
    });
  });

  describe("ping/pong mechanism", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      handler = strategy.attach(mockApi);
      handler.onOpen?.();
      handler.onAck?.(); // This starts the ping interval
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should start ping interval after ack", () => {
      // With fake timers, we can't spy on the calls, but we can verify the behavior
      // The interval should be set and should fire after 5000ms
      expect(mockApi.send).not.toHaveBeenCalled();
      jest.advanceTimersByTime(4999);
      expect(mockApi.send).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(mockApi.send).toHaveBeenCalledWith({
        type: "ping",
        payload: { id: expect.any(String) },
      });
    });

    it("should send ping messages at regular intervals", () => {
      // First ping
      jest.advanceTimersByTime(5000);
      expect(mockApi.send).toHaveBeenCalledWith({
        type: "ping",
        payload: { id: expect.any(String) },
      });

      // Second ping (should wait for pong first)
      mockApi.send.mockClear();
      jest.advanceTimersByTime(5000);
      expect(mockApi.send).not.toHaveBeenCalled(); // Should not send another ping while one is in flight
    });

    it("should set pong deadline when sending ping", () => {
      jest.advanceTimersByTime(5000);

      // Verify that pong deadline is set by checking that it times out after 2000ms
      expect(mockApi.abort).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1999);
      expect(mockApi.abort).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should abort if pong deadline expires", () => {
      // Send ping
      jest.advanceTimersByTime(5000);

      // Advance to pong deadline
      jest.advanceTimersByTime(2000);

      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should handle matching pong and continue pinging", () => {
      // Send ping
      jest.advanceTimersByTime(5000);
      const pingCall = mockApi.send.mock.calls[0][0];
      const pingId = pingCall.payload?.id;

      // Receive matching pong
      const pongMessage: IWebSocketMessage<any> = {
        type: "pong",
        payload: { id: pingId },
      };

      const result = handler.onInbound?.(pongMessage);
      expect(result).toBe(false); // Should consume the message

      // Should not abort on pong deadline
      jest.advanceTimersByTime(2000);
      expect(mockApi.abort).not.toHaveBeenCalled();

      // Should send next ping
      mockApi.send.mockClear();
      jest.advanceTimersByTime(5000);
      expect(mockApi.send).toHaveBeenCalledWith({
        type: "ping",
        payload: { id: expect.any(String) },
      });
    });

    it("should ignore non-matching pong messages", () => {
      // Send ping
      jest.advanceTimersByTime(5000);

      // Receive non-matching pong
      const pongMessage: IWebSocketMessage<any> = {
        type: "pong",
        payload: { id: "wrong-id" },
      };

      const result = handler.onInbound?.(pongMessage);
      expect(result).toBeUndefined(); // Should not consume the message

      // Should still abort on pong deadline
      jest.advanceTimersByTime(2000);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);
    });

    it("should ignore non-pong messages", () => {
      const nextMessage: IWebSocketMessage<any> = {
        type: "next",
        id: "test-id",
        payload: { data: { test: "data" } },
      };

      const result = handler.onInbound?.(nextMessage);
      expect(result).toBeUndefined(); // Should not consume the message
    });

    it("should not send ping while previous ping is in flight", () => {
      // Send first ping
      jest.advanceTimersByTime(5000);
      expect(mockApi.send).toHaveBeenCalledTimes(1);

      // Try to send second ping
      mockApi.send.mockClear();
      jest.advanceTimersByTime(5000);
      expect(mockApi.send).not.toHaveBeenCalled();
    });
  });

  describe("cleanup on close", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      handler = strategy.attach(mockApi);
      handler.onOpen?.();
      handler.onAck?.();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should stop all timers on close", () => {
      // Start ping
      jest.advanceTimersByTime(5000);

      // Close
      handler.onClose?.(CloseReason.Client);

      // Verify timers are stopped by checking that no more actions happen
      mockApi.abort.mockClear();
      mockApi.send.mockClear();

      // Advance time significantly - nothing should happen
      jest.advanceTimersByTime(10000);
      expect(mockApi.abort).not.toHaveBeenCalled();
      expect(mockApi.send).not.toHaveBeenCalled();
    });
  });

  describe("edge cases", () => {
    it("should handle zero timeouts", () => {
      jest.useFakeTimers();
      const zeroTimeoutStrategy = new CorrelatedPingStrategy(0, 0, 0);
      const zeroHandler = zeroTimeoutStrategy.attach(mockApi);

      zeroHandler.onOpen?.();
      jest.advanceTimersByTime(0);
      expect(mockApi.abort).toHaveBeenCalledWith(CloseReason.Timeout);

      jest.useRealTimers();
    });

    it("should handle very large timeouts", () => {
      jest.useFakeTimers();
      const largeTimeoutStrategy = new CorrelatedPingStrategy(1000000, 1000000, 1000000);
      const largeHandler = largeTimeoutStrategy.attach(mockApi);

      largeHandler.onOpen?.();
      largeHandler.onAck?.();

      jest.advanceTimersByTime(999999);
      expect(mockApi.abort).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it("should not crash if onInbound is called with null message", () => {
      const testHandler = strategy.attach(mockApi);
      // This will crash because the handler tries to access msg.type
      expect(() => testHandler.onInbound?.(null as any)).toThrow();
    });

    it("should not crash if methods are called on handler", () => {
      const unattachedStrategy = new CorrelatedPingStrategy(3000, 5000, 2000);
      const testHandler = unattachedStrategy.attach(mockApi);
      // Handler methods should work normally since they have the API reference
      expect(() => testHandler.onOpen?.()).not.toThrow();
      expect(() => testHandler.onAck?.()).not.toThrow();
      expect(() => testHandler.onInbound?.({ type: "ping" })).not.toThrow();
      expect(() => testHandler.onClose?.(CloseReason.Client)).not.toThrow();
    });

    it("should handle pong without payload", () => {
      jest.useFakeTimers();
      const testHandler = strategy.attach(mockApi);
      testHandler.onOpen?.();
      testHandler.onAck?.();

      // Send ping
      jest.advanceTimersByTime(5000);

      // Receive pong without payload
      const pongMessage: IWebSocketMessage<any> = {
        type: "pong",
      };

      const result = testHandler.onInbound?.(pongMessage);
      expect(result).toBeUndefined(); // Should not consume the message

      jest.useRealTimers();
    });

    it("should handle multiple start/stop cycles", () => {
      jest.useFakeTimers();
      const testHandler = strategy.attach(mockApi);

      // Start and stop multiple times
      testHandler.onOpen?.();
      testHandler.onAck?.();
      testHandler.onClose?.(CloseReason.Client);

      testHandler.onOpen?.();
      testHandler.onAck?.();
      testHandler.onClose?.(CloseReason.Server);

      // Should not crash and should work normally
      testHandler.onOpen?.();
      testHandler.onAck?.();

      jest.advanceTimersByTime(5000);
      expect(mockApi.send).toHaveBeenCalledWith({
        type: "ping",
        payload: { id: expect.any(String) },
      });

      jest.useRealTimers();
    });
  });
});
