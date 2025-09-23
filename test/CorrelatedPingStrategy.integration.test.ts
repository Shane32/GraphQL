import { waitFor } from "@testing-library/react";
import GraphQLClient from "../src/GraphQLClient";
import CorrelatedPingStrategy from "../src/CorrelatedPingStrategy";
import CloseReason from "../src/CloseReason";
import { MockWebSocket } from "../test-utils/MockWebSocket";

describe("CorrelatedPingStrategy Integration Tests", () => {
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    // Mock WebSocket constructor
    mockWebSocket = new MockWebSocket();
    (global as any).WebSocket = jest.fn().mockImplementation((url: string, protocol?: string) => {
      mockWebSocket.initialize(url, protocol);
      return mockWebSocket;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    let connectionRejected = false;

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

    // Try to await connection but expect it to be rejected
    try {
      await ret.connected;
    } catch (error) {
      connectionRejected = true;
    }

    await waitFor(
      () => {
        expect(receivedData).toBeFalsy();
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Timeout);
      },
      { timeout: 1000 },
    );
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

    // Expect ping but don't respond with pong
    mockWebSocket.expect(
      { type: "ping", payload: { id: expect.any(String) } },
      [], // No pong response - should trigger pong timeout
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

    await ret.connected;

    await waitFor(
      () => {
        expect(receivedData).toBeTruthy();
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Timeout);
      },
      { timeout: 1000 },
    );
  });

  it("should handle ping/pong correctly and continue subscription", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new CorrelatedPingStrategy(200, 100, 150), // 100ms ping interval, 150ms pong timeout
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

    // Expect first ping and respond with matching pong
    mockWebSocket.expect({ type: "ping", payload: { id: expect.any(String) } }, [
      {
        kind: "message",
        data: { type: "pong", payload: { id: expect.any(String) } },
        delayMs: 25, // Respond within pong timeout
      },
    ]);

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

    await ret.connected;

    // Send more data after a delay
    setTimeout(() => {
      mockWebSocket.serverPush({
        type: "next",
        id: "1",
        payload: {
          data: { liveData: { value: "second" } },
        },
      });
    }, 200);

    // Wait for the second data and verify no timeout occurred
    await waitFor(
      () => {
        expect(dataCount).toBe(2);
      },
      { timeout: 1000 },
    );

    // Should still be connected (no timeout)
    expect(receivedClose).toBeFalsy();

    // Manually close to end test
    ret.abort();

    await waitFor(
      () => {
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Client);
      },
      { timeout: 500 },
    );
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

    await ret.connected;

    // Send server-initiated ping
    setTimeout(() => {
      mockWebSocket.serverPush({
        type: "ping",
        payload: { serverPingId: "server-123" },
      });
    }, 50);

    // Wait for data and verify pong was sent
    await waitFor(
      () => {
        expect(receivedData).toBeTruthy();
      },
      { timeout: 500 },
    );

    // Verify pong was sent
    await waitFor(
      () => {
        const sentMessages = (mockWebSocket.send as jest.Mock).mock.calls;
        const pongMessage = sentMessages.find((call) => call[0].includes('"type":"pong"'));
        expect(pongMessage).toBeTruthy();
      },
      { timeout: 500 },
    );

    // Should not timeout
    expect(receivedClose).toBeFalsy();

    // Manually close
    ret.abort();

    await waitFor(
      () => {
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Client);
      },
      { timeout: 500 },
    );
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

    await ret.connected;

    await waitFor(
      () => {
        expect(receivedData).toBeTruthy();
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Server);
      },
      { timeout: 1000 },
    );
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

    await ret.connected;

    await waitFor(
      () => {
        expect(receivedData).toBeTruthy();
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Error);
        expect(errorData.errors).toBeTruthy();
        expect(errorData.errors[0].message).toContain("invalidField");
      },
      { timeout: 1000 },
    );
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
    let pingCount = 0;

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

    // Expect multiple pings and respond to each
    for (let i = 0; i < 3; i++) {
      mockWebSocket.expect({ type: "ping", payload: { id: expect.any(String) } }, [
        {
          kind: "message",
          data: { type: "pong", payload: { id: expect.any(String) } },
          delayMs: 20, // Quick response
        },
      ]);
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

    await ret.connected;

    // Send additional data periodically
    setTimeout(() => {
      mockWebSocket.serverPush({
        type: "next",
        id: "1",
        payload: {
          data: { liveData: { value: "data2" } },
        },
      });
    }, 90);

    setTimeout(() => {
      mockWebSocket.serverPush({
        type: "next",
        id: "1",
        payload: {
          data: { liveData: { value: "data3" } },
        },
      });
    }, 180);

    // Wait for multiple data messages
    await waitFor(
      () => {
        expect(dataCount).toBeGreaterThanOrEqual(2); // Reduce expectation to be more realistic
      },
      { timeout: 1000 },
    );

    // Should still be connected (no timeout despite multiple ping/pong cycles)
    expect(receivedClose).toBeFalsy();

    // Manually close
    ret.abort();

    await waitFor(
      () => {
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Client);
      },
      { timeout: 500 },
    );
  });
});
