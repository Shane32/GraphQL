import { waitFor } from "@testing-library/react";
import GraphQLClient from "../src/GraphQLClient";
import IdleTimeoutStrategy from "../src/IdleTimeoutStrategy";
import CloseReason from "../src/CloseReason";
import { MockWebSocket } from "../test-utils/MockWebSocket";

describe("IdleTimeoutStrategy Integration Tests", () => {
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

  it("should timeout subscription when no messages received within idle period", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new IdleTimeoutStrategy(100), // 100ms idle timeout for fast test
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
              data: { liveData: { value: "initial" } },
            },
          },
        },
        // No more messages - should trigger idle timeout after 100ms
      ],
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

    // Wait for timeout to occur
    await waitFor(
      () => {
        expect(receivedData).toBeTruthy();
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Timeout);
      },
      { timeout: 1000 },
    );
  });

  it("should reset idle timeout when messages are received", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new IdleTimeoutStrategy(150), // 150ms idle timeout
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

    // Wait a bit, then send another message to reset the timeout
    setTimeout(() => {
      mockWebSocket.serverPush({
        type: "next",
        id: "1",
        payload: {
          data: { liveData: { value: "second" } },
        },
      });
    }, 100);

    // Should eventually timeout after the reset
    await waitFor(
      () => {
        expect(dataCount).toBe(2);
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Timeout);
      },
      { timeout: 1000 },
    );
  });

  it("should not timeout when subscription completes normally", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new IdleTimeoutStrategy(200), // 200ms idle timeout
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
        {
          kind: "message",
          data: { type: "complete", id: "1" },
          delayMs: 50, // Complete before timeout
        },
      ],
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
        expect(closeReason).toBe(CloseReason.Server); // Should be server close, not timeout
      },
      { timeout: 1000 },
    );
  });

  it("should handle subscription with per-request timeout strategy override", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new IdleTimeoutStrategy(500), // Default 500ms timeout
      },
    });

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

    const ret = client.ExecuteSubscription<{ liveData: { value: string } }>(
      {
        query: "subscription { liveData { value } }",
      },
      (data) => {},
      (reason) => {
        receivedClose = true;
        closeReason = reason;
      },
      {
        timeoutStrategy: new IdleTimeoutStrategy(50), // Override with 50ms timeout
      },
    );

    await ret.connected;

    // Should timeout after 50ms (override), not 500ms (default)
    await waitFor(
      () => {
        expect(receivedClose).toBeTruthy();
        expect(closeReason).toBe(CloseReason.Timeout);
      },
      { timeout: 500 },
    );
  });

  it("should handle client-initiated abort correctly", async () => {
    const client = new GraphQLClient({
      url: "https://api.example.com/api/graphql",
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        timeoutStrategy: new IdleTimeoutStrategy(1000), // Long timeout
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

    // Wait for initial data
    await waitFor(
      () => {
        expect(receivedData).toBeTruthy();
      },
      { timeout: 500 },
    );

    // Manually abort before timeout
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
