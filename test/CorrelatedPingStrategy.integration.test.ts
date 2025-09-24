import GraphQLClient from "../src/GraphQLClient";
import CorrelatedPingStrategy from "../src/CorrelatedPingStrategy";
import CloseReason from "../src/CloseReason";
import { MockWebSocket } from "./MockWebSocket";

describe("CorrelatedPingStrategy Integration Tests", () => {
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    jest.useFakeTimers();
    // Mock WebSocket constructor
    mockWebSocket = new MockWebSocket();
    (global as any).WebSocket = jest.fn().mockImplementation((url: string, protocol?: string) => {
      mockWebSocket.initialize(url, protocol);
      return mockWebSocket;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllTimers();
    // Reset mock WebSocket state
    if (mockWebSocket) {
      mockWebSocket = null!;
    }
  });

  it("should timeout subscription when connection acknowledgment is not received", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(100, 500, 200), // 100ms ack timeout
      },
    });

    let receivedData = false;
    let receivedClose = false;
    let closeReason: CloseReason | undefined;

    // Set up mock WebSocket expectations - no connection_ack response
    mockWebSocket.expect(
      { type: "connection_init", payload: undefined },
      [], // No response - should trigger ack timeout
    );

    const ret = client.ExecuteSubscription<{ liveData: { value: string } }>(
      {
        query: "subscription { liveData { value } }",
      },
      (data) => {
        receivedData = true;
      },
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
    );

    // The connection should be rejected due to timeout
    let connectSuccess: boolean | undefined = undefined;
    ret.connected
      .then(() => {
        connectSuccess = true;
      })
      .catch(() => {
        connectSuccess = false;
      });

    // Advance time to trigger ack timeout
    await jest.advanceTimersByTimeAsync(10);
    await jest.advanceTimersByTimeAsync(100);
    await jest.advanceTimersByTimeAsync(10);

    expect(receivedData).toBeFalsy();
    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Timeout);
    expect(connectSuccess).toBeDefined();
    expect(connectSuccess).toBe(false);
  });

  it("should send periodic pings and timeout when pong is not received", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(200, 100, 50), // 100ms ping interval, 50ms pong timeout
      },
    });

    let receivedData = false;
    let receivedClose = false;
    let closeReason: CloseReason | undefined;

    // Set up mock WebSocket expectations
    mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

    mockWebSocket.expect(
      {
        id: "1",
        type: "subscribe",
        payload: { query: "subscription { liveData { value } }" },
      },
      [
        {
          kind: "message",
          data: {
            type: "next",
            id: "1",
            payload: {
              data: { liveData: { value: "data" } },
            },
          },
        },
      ],
    );

    // Expect ping but don't respond with pong - should trigger timeout
    mockWebSocket.expectFunction((actual) => {
      try {
        const msg = JSON.parse(actual);
        if (msg && msg.type === "ping" && msg.payload && typeof msg.payload.id === "string") {
          return []; // No pong response - should trigger pong timeout
        }
      } catch {}
      return null;
    });

    const ret = client.ExecuteSubscription<{ liveData: { value: string } }>(
      {
        query: "subscription { liveData { value } }",
      },
      (data) => {
        receivedData = true;
      },
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
    );

    await jest.advanceTimersByTimeAsync(10);
    await ret.connected;

    // Advance time to trigger ping interval and then pong timeout
    await jest.advanceTimersByTimeAsync(100); // Trigger ping
    await jest.advanceTimersByTimeAsync(50); // Trigger pong timeout

    expect(receivedData).toBeTruthy();
    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Timeout);
  });

  it("should handle ping/pong correctly and continue subscription", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(200, 300, 200), // 300ms ping interval, 200ms pong timeout
      },
    });

    let dataCount = 0;
    let receivedClose = false;
    let closeReason: CloseReason | undefined;

    // Set up mock WebSocket expectations
    mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

    mockWebSocket.expect(
      {
        id: "1",
        type: "subscribe",
        payload: { query: "subscription { liveData { value } }" },
      },
      [
        {
          kind: "message",
          data: {
            type: "next",
            id: "1",
            payload: {
              data: { liveData: { value: "first" } },
            },
          },
        },
      ],
    );

    // Set up expectations for multiple pings that might occur and respond with pongs
    for (let i = 0; i < 5; i++) {
      mockWebSocket.expectFunction((actual) => {
        try {
          const msg = JSON.parse(actual);
          if (msg && msg.type === "ping" && msg.payload && typeof msg.payload.id === "string") {
            return [
              {
                kind: "message",
                data: { type: "pong", payload: { id: msg.payload.id } },
                delayMs: 10,
              },
            ];
          }
        } catch {}
        return null;
      });
    }

    const ret = client.ExecuteSubscription<{ liveData: { value: string } }>(
      {
        query: "subscription { liveData { value } }",
      },
      (data) => {
        dataCount++;
      },
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
    );

    await jest.advanceTimersByTimeAsync(10);
    await ret.connected;

    // Send more data after a short delay
    await jest.advanceTimersByTimeAsync(50);

    mockWebSocket.serverPush({
      type: "next",
      id: "1",
      payload: {
        data: { liveData: { value: "second" } },
      },
    });

    // Allow time for the message to be processed
    await jest.advanceTimersByTimeAsync(1);

    expect(dataCount).toBe(2);

    // Should still be connected (no timeout)
    expect(receivedClose).toBeFalsy();

    // Manually close to end test
    ret.abort();

    // Allow time for the abort to be processed
    await jest.advanceTimersByTimeAsync(1);

    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Client);
  });

  it("should handle server-initiated pings correctly", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(200, 500, 300), // Long intervals to avoid client pings
      },
    });

    let receivedData = false;
    let receivedClose = false;
    let closeReason: CloseReason | undefined;

    // Set up mock WebSocket expectations
    mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

    mockWebSocket.expect(
      {
        id: "1",
        type: "subscribe",
        payload: { query: "subscription { liveData { value } }" },
      },
      [
        {
          kind: "message",
          data: {
            type: "next",
            id: "1",
            payload: {
              data: { liveData: { value: "data" } },
            },
          },
        },
      ],
    );

    // Expect pong response to server ping
    mockWebSocket.expect({ type: "pong", payload: { serverPingId: "server-123" } }, []);

    const ret = client.ExecuteSubscription<{ liveData: { value: string } }>(
      {
        query: "subscription { liveData { value } }",
      },
      (data) => {
        receivedData = true;
      },
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
    );

    await jest.advanceTimersByTimeAsync(10);
    await ret.connected;

    // Send server-initiated ping
    await jest.advanceTimersByTimeAsync(50);

    mockWebSocket.serverPush({
      type: "ping",
      payload: { serverPingId: "server-123" },
    });

    // Allow time for the ping to be processed
    await jest.advanceTimersByTimeAsync(1);

    expect(receivedData).toBeTruthy();

    // Verify pong was sent
    const sentMessages = (mockWebSocket.send as jest.Mock).mock.calls;
    const pongMessage = sentMessages.find((call) => call[0].includes('"type":"pong"'));
    expect(pongMessage).toBeTruthy();

    // Should not timeout
    expect(receivedClose).toBeFalsy();

    // Manually close
    ret.abort();

    // Allow time for the abort to be processed
    await jest.advanceTimersByTimeAsync(1);

    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Client);
  });

  it("should handle connection with custom payload", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      generatePayload: () => ({ token: "auth-token-123" }),
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(200, 500, 300),
      },
    });

    let receivedData = false;
    let receivedClose = false;
    let closeReason: CloseReason | undefined;

    // Set up mock WebSocket expectations with custom payload
    mockWebSocket.expect({ type: "connection_init", payload: { token: "auth-token-123" } }, [
      { kind: "message", data: { type: "connection_ack" } },
    ]);

    mockWebSocket.expect(
      {
        id: "1",
        type: "subscribe",
        payload: { query: "subscription { authenticatedData { value } }" },
      },
      [
        {
          kind: "message",
          data: {
            type: "next",
            id: "1",
            payload: {
              data: { authenticatedData: { value: "secret-data" } },
            },
          },
        },
        {
          kind: "message",
          data: { type: "complete", id: "1" },
          delayMs: 100,
        },
      ],
    );

    const ret = client.ExecuteSubscription<{ authenticatedData: { value: string } }>(
      {
        query: "subscription { authenticatedData { value } }",
      },
      (data) => {
        receivedData = true;
      },
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
    );

    await jest.advanceTimersByTimeAsync(10);
    await ret.connected;

    // Advance time to trigger the complete message
    await jest.advanceTimersByTimeAsync(100);

    expect(receivedData).toBeTruthy();
    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Server);
  });

  it("should handle subscription errors correctly", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(200, 500, 300),
      },
    });

    let receivedData = false;
    let receivedClose = false;
    let closeReason: CloseReason | undefined;
    let errorData: any = null;

    // Set up mock WebSocket expectations
    mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

    mockWebSocket.expect(
      {
        id: "1",
        type: "subscribe",
        payload: { query: "subscription { invalidField { value } }" },
      },
      [
        {
          kind: "message",
          data: {
            type: "error",
            id: "1",
            payload: [{ message: "Field 'invalidField' doesn't exist" }],
          },
        },
      ],
    );

    const ret = client.ExecuteSubscription<{ invalidField: { value: string } }>(
      {
        query: "subscription { invalidField { value } }",
      },
      (data) => {
        receivedData = true;
        errorData = data;
      },
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
    );

    await jest.advanceTimersByTimeAsync(10);
    await ret.connected;

    expect(receivedData).toBeTruthy();
    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Error);
    expect(errorData.errors).toBeTruthy();
    expect(errorData.errors[0].message).toContain("invalidField");
  });

  it("should handle multiple ping/pong cycles", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(200, 80, 100), // 80ms ping interval, 100ms pong timeout
      },
    });

    let dataCount = 0;
    let receivedClose = false;
    let closeReason: CloseReason | undefined;

    // Set up mock WebSocket expectations
    mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

    mockWebSocket.expect(
      {
        id: "1",
        type: "subscribe",
        payload: { query: "subscription { liveData { value } }" },
      },
      [
        {
          kind: "message",
          data: {
            type: "next",
            id: "1",
            payload: {
              data: { liveData: { value: "data1" } },
            },
          },
        },
      ],
    );

    // Expect multiple pings and respond to each with matching pong
    for (let i = 0; i < 5; i++) {
      mockWebSocket.expectFunction((actual) => {
        try {
          const msg = JSON.parse(actual);
          if (msg && msg.type === "ping" && msg.payload && typeof msg.payload.id === "string") {
            return [
              {
                kind: "message",
                data: { type: "pong", payload: { id: msg.payload.id } },
                delayMs: 20,
              },
            ];
          }
        } catch {}
        return null;
      });
    }

    const ret = client.ExecuteSubscription<{ liveData: { value: string } }>(
      {
        query: "subscription { liveData { value } }",
      },
      (data) => {
        dataCount++;
      },
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
    );

    await jest.advanceTimersByTimeAsync(10);
    await ret.connected;

    // Send additional data periodically
    await jest.advanceTimersByTimeAsync(90);

    mockWebSocket.serverPush({
      type: "next",
      id: "1",
      payload: {
        data: { liveData: { value: "data2" } },
      },
    });

    await jest.advanceTimersByTimeAsync(90);
    mockWebSocket.serverPush({
      type: "next",
      id: "1",
      payload: {
        data: { liveData: { value: "data3" } },
      },
    });

    expect(dataCount).toBeGreaterThanOrEqual(2);

    // Should still be connected (no timeout despite multiple ping/pong cycles)
    expect(receivedClose).toBeFalsy();

    // Manually close
    ret.abort();

    // Allow time for the abort to be processed
    await jest.advanceTimersByTimeAsync(1);

    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Client);
  });
});
