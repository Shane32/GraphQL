import * as React from "react";
import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import GraphQLClient from "../src/GraphQLClient";
import GraphQLContext from "../src/GraphQLContext";
import useSubscription from "../src/useSubscription";
import { waitFor, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";
import CloseReason from "../src/CloseReason";
import { MockWebSocket } from "./MockWebSocket";

let OriginalWebSocket: any;

beforeAll(() => {
  OriginalWebSocket = globalThis.WebSocket;
});

let mockWebSocket: MockWebSocket;

beforeEach(() => {
  mockWebSocket = new MockWebSocket();

  // Replace the constructor for this test
  (globalThis as any).WebSocket = jest.fn((url: string, protocol?: string) => {
    mockWebSocket.initialize(url, protocol);
    return mockWebSocket as unknown as WebSocket;
  });

  // (Optional) if your code references WebSocket.OPEN/CLOSED/etc:
  (globalThis.WebSocket as any).OPEN = 1;
  (globalThis.WebSocket as any).CLOSED = 3;
  (globalThis.WebSocket as any).CONNECTING = 0;
  (globalThis.WebSocket as any).CLOSING = 2;
});

afterEach(() => {
  mockWebSocket?.close?.();
  jest.restoreAllMocks();
});

afterAll(() => {
  (globalThis as any).WebSocket = OriginalWebSocket;
});

interface TestData {
  pokemon_v2_version: Array<{ name: string }>;
}

const useSubscriptionTest = async () => {
  function TestUseSubscription() {
    const [subscriptionConnected, setSubscriptionConnected] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [receivedData, setReceivedData] = React.useState<TestData[]>([]);
    const [closeReason, setCloseReason] = React.useState<CloseReason | undefined>();

    const [subscribe] = useSubscription<TestData>("subscription { pokemon_v2_version { name } }", {
      onData: (data) => {
        if (data.data) {
          setReceivedData((prev) => [...prev, data.data!]);
        }
      },
      onClose: (reason) => {
        setCloseReason(reason);
      },
    });

    React.useEffect(() => {
      try {
        const subscription = subscribe();
        subscription.connected
          .then(() => {
            setSubscriptionConnected(true);
          })
          .catch((err) => {
            setError(err?.message || "Connection failed");
          });
        return () => subscription.abort();
      } catch (err: any) {
        setError(err?.message || "Subscription failed");
      }
    }, [subscribe]);

    return (
      <div>
        <p>Connected: {subscriptionConnected ? "Yes" : "No"}</p>
        <p>Data Count: {receivedData.length}</p>
        {error && <p>Error: {error}</p>}
        {receivedData.map((data, index) => (
          <div key={index}>
            {data.pokemon_v2_version.map((pokemon, pokemonIndex) => (
              <p key={pokemonIndex}>Pokemon: {pokemon.name}</p>
            ))}
          </div>
        ))}
        {closeReason && <p>Closed: {CloseReason[closeReason]}</p>}
      </div>
    );
  }

  // Set up mock WebSocket expectations
  mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

  mockWebSocket.expect(
    {
      id: "1",
      type: "subscribe",
      payload: { query: "subscription { pokemon_v2_version { name } }" },
    },
    [
      {
        kind: "message",
        data: {
          type: "next",
          id: "1",
          payload: {
            data: { pokemon_v2_version: [{ name: "red" }] },
          },
        },
      },
      {
        kind: "message",
        data: {
          type: "next",
          id: "1",
          payload: {
            data: { pokemon_v2_version: [{ name: "blue" }] },
          },
        },
      },
      {
        kind: "message",
        data: {
          type: "next",
          id: "1",
          payload: {
            data: { pokemon_v2_version: [{ name: "yellow" }] },
          },
        },
      },
      { kind: "message", data: { type: "complete", id: "1" } },
    ],
  );

  act(() => {
    const client = new GraphQLClient({
      url: "", // unused for subscriptions
      webSocketUrl: "ws://test/graphql",
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Wait for connection
  await waitFor(() => expect(screen.getByText("Connected: Yes")).toBeInTheDocument());

  // Wait for all data packets
  await waitFor(() => expect(screen.getByText("Data Count: 3")).toBeInTheDocument());

  // Verify individual data packets were received
  expect(screen.getByText("Pokemon: red")).toBeInTheDocument();
  expect(screen.getByText("Pokemon: blue")).toBeInTheDocument();
  expect(screen.getByText("Pokemon: yellow")).toBeInTheDocument();

  // Wait for subscription to close
  await waitFor(() => expect(screen.getByText("Closed: Server")).toBeInTheDocument());
};

it("useSubscription works", () => useSubscriptionTest());

const useSubscriptionWithFunctionCallbacksTest = async () => {
  function TestUseSubscription() {
    const [receivedData, setReceivedData] = React.useState<TestData[]>([]);
    const [closeReason, setCloseReason] = React.useState<CloseReason | undefined>();
    const [error, setError] = React.useState<string | null>(null);
    const [subscribe] = useSubscription<TestData>("subscription { pokemon_v2_version { name } }");

    React.useEffect(() => {
      try {
        const subscription = subscribe({
          onData: (data) => {
            if (data.data) {
              setReceivedData((prev) => [...prev, data.data!]);
            }
          },
          onClose: (reason) => {
            setCloseReason(reason);
          },
        });
        subscription.connected.catch((err) => {
          setError(err?.message || "Connection failed");
        });
        return () => subscription.abort();
      } catch (err: any) {
        setError(err?.message || "Subscription failed");
      }
    }, [subscribe]);

    return (
      <div>
        <p>Data Count: {receivedData.length}</p>
        {error && <p>Error: {error}</p>}
        {receivedData.map((data, index) => (
          <div key={index}>
            {data.pokemon_v2_version.map((pokemon, pokemonIndex) => (
              <p key={pokemonIndex}>Pokemon: {pokemon.name}</p>
            ))}
          </div>
        ))}
        {closeReason && <p>Closed: {CloseReason[closeReason]}</p>}
      </div>
    );
  }

  // Set up mock WebSocket expectations
  mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

  mockWebSocket.expect(
    {
      id: "1",
      type: "subscribe",
      payload: { query: "subscription { pokemon_v2_version { name } }" },
    },
    [
      {
        kind: "message",
        data: {
          type: "next",
          id: "1",
          payload: {
            data: { pokemon_v2_version: [{ name: "green" }] },
          },
        },
      },
      { kind: "message", data: { type: "complete", id: "1" } },
    ],
  );

  act(() => {
    const client = new GraphQLClient({
      url: "", // unused for subscriptions
      webSocketUrl: "ws://test/graphql",
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Wait for data and close
  await waitFor(() => expect(screen.getByText("Data Count: 1")).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText("Closed: Server")).toBeInTheDocument());

  // Verify the data was received correctly by checking the rendered content
  expect(screen.getByText("Pokemon: green")).toBeInTheDocument();
};

it("useSubscription works with function-level callbacks", () => useSubscriptionWithFunctionCallbacksTest());
