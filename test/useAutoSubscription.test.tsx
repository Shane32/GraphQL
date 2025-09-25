import * as React from "react";
import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import GraphQLClient from "../src/GraphQLClient";
import GraphQLContext from "../src/GraphQLContext";
import useAutoSubscription, { AutoSubscriptionState } from "../src/useAutoSubscription";
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

it("useAutoSubscription basic functionality works", async () => {
  function TestUseAutoSubscription() {
    const [receivedData, setReceivedData] = React.useState<TestData[]>([]);
    const [closeReason, setCloseReason] = React.useState<CloseReason | undefined>();
    const [openCount, setOpenCount] = React.useState(0);

    const { state } = useAutoSubscription<TestData>("subscription { pokemon_v2_version { name } }", {
      onData: (data) => {
        if (data.data) {
          setReceivedData((prev) => [...prev, data.data!]);
        }
      },
      onOpen: () => {
        setOpenCount((prev) => prev + 1);
      },
      onClose: (reason) => {
        setCloseReason(reason);
      },
    });

    return (
      <div>
        <p>State: {state}</p>
        <p>Opens: {openCount}</p>
        <p>Data Count: {receivedData.length}</p>
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
      { kind: "message", data: { type: "complete", id: "1" } },
    ],
  );

  act(() => {
    const client = new GraphQLClient({
      url: "", // unused for subscriptions
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        reconnectionStrategy: 0, // Immediate
      },
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseAutoSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Initially should be connecting
  expect(screen.getByText("State: Connecting")).toBeInTheDocument();

  // Wait for connection
  await waitFor(() => expect(screen.getByText("State: Connected")).toBeInTheDocument());
  expect(screen.getByText("Opens: 1")).toBeInTheDocument();

  // Wait for data packets
  await waitFor(() => expect(screen.getByText("Data Count: 2")).toBeInTheDocument());

  // Verify individual data packets were received
  expect(screen.getByText("Pokemon: red")).toBeInTheDocument();
  expect(screen.getByText("Pokemon: blue")).toBeInTheDocument();

  // Wait for subscription to close and reconnect attempt
  await waitFor(() => expect(screen.getByText("State: Completed")).toBeInTheDocument());
});

it("useAutoSubscription enabled/disabled functionality works", async () => {
  function TestUseAutoSubscription() {
    const [enabled, setEnabled] = React.useState(true);
    const [receivedData, setReceivedData] = React.useState<TestData[]>([]);
    const [openCount, setOpenCount] = React.useState(0);

    const { state } = useAutoSubscription<TestData>("subscription { pokemon_v2_version { name } }", {
      enabled,
      onData: (data) => {
        if (data.data) {
          setReceivedData((prev) => [...prev, data.data!]);
        }
      },
      onOpen: () => {
        setOpenCount((prev) => prev + 1);
      },
    });

    return (
      <div>
        <p>State: {state}</p>
        <p>Opens: {openCount}</p>
        <p>Data Count: {receivedData.length}</p>
        <button onClick={() => setEnabled(!enabled)}>Toggle Enabled</button>
        {receivedData.map((data, index) => (
          <div key={index}>
            {data.pokemon_v2_version.map((pokemon, pokemonIndex) => (
              <p key={pokemonIndex}>Pokemon: {pokemon.name}</p>
            ))}
          </div>
        ))}
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
    ],
  );

  act(() => {
    const client = new GraphQLClient({
      url: "", // unused for subscriptions
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        reconnectionStrategy: 0, // Immediate
      },
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseAutoSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Wait for connection
  await waitFor(() => expect(screen.getByText("State: Connected")).toBeInTheDocument());
  expect(screen.getByText("Opens: 1")).toBeInTheDocument();

  // Wait for data
  await waitFor(() => expect(screen.getByText("Data Count: 1")).toBeInTheDocument());
  expect(screen.getByText("Pokemon: green")).toBeInTheDocument();

  // Disable the subscription
  act(() => {
    screen.getByText("Toggle Enabled").click();
  });

  // Should become disconnected
  await waitFor(() => expect(screen.getByText("State: Disconnected")).toBeInTheDocument());
});

it("useAutoSubscription starts disabled and can be enabled", async () => {
  function TestUseAutoSubscription() {
    const [enabled, setEnabled] = React.useState(false);
    const [openCount, setOpenCount] = React.useState(0);

    const { state } = useAutoSubscription<TestData>("subscription { pokemon_v2_version { name } }", {
      enabled,
      onOpen: () => {
        setOpenCount((prev) => prev + 1);
      },
    });

    return (
      <div>
        <p>State: {state}</p>
        <p>Opens: {openCount}</p>
        <button onClick={() => setEnabled(true)}>Enable</button>
      </div>
    );
  }

  act(() => {
    const client = new GraphQLClient({
      url: "", // unused for subscriptions
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        reconnectionStrategy: 0, // Immediate
      },
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseAutoSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Should start disconnected
  expect(screen.getByText("State: Disconnected")).toBeInTheDocument();
  expect(screen.getByText("Opens: 0")).toBeInTheDocument();

  // Set up mock WebSocket expectations for when we enable
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
            data: { pokemon_v2_version: [{ name: "yellow" }] },
          },
        },
      },
      { kind: "message", data: { type: "complete", id: "1" } },
    ],
  );

  // Enable the subscription
  act(() => {
    screen.getByText("Enable").click();
  });

  // Should start connecting
  await waitFor(() => expect(screen.getByText("State: Connecting")).toBeInTheDocument());

  // Wait for connection
  await waitFor(() => expect(screen.getByText("State: Connected")).toBeInTheDocument());
  expect(screen.getByText("Opens: 1")).toBeInTheDocument();
});

it("useAutoSubscription works with variables function", async () => {
  function TestUseAutoSubscription() {
    const [version, setVersion] = React.useState("v1");
    const [receivedData, setReceivedData] = React.useState<TestData[]>([]);
    const [openCount, setOpenCount] = React.useState(0);

    const { state } = useAutoSubscription<TestData>(
      "subscription ($version: String!) { pokemon_v2_version(where: {name: {_eq: $version}}) { name } }",
      {
        variables: () => ({ version }),
        onData: (data) => {
          if (data.data) {
            setReceivedData((prev) => [...prev, data.data!]);
          }
        },
        onOpen: () => {
          setOpenCount((prev) => prev + 1);
        },
      },
    );

    return (
      <div>
        <p>State: {state}</p>
        <p>Opens: {openCount}</p>
        <p>Data Count: {receivedData.length}</p>
        <p>Current Version: {version}</p>
        <button onClick={() => setVersion("v2")}>Change Version</button>
        {receivedData.map((data, index) => (
          <div key={index}>
            {data.pokemon_v2_version.map((pokemon, pokemonIndex) => (
              <p key={pokemonIndex}>Pokemon: {pokemon.name}</p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Set up mock WebSocket expectations
  mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

  mockWebSocket.expect(
    {
      id: "1",
      type: "subscribe",
      payload: {
        query: "subscription ($version: String!) { pokemon_v2_version(where: {name: {_eq: $version}}) { name } }",
        variables: { version: "v1" },
      },
    },
    [
      {
        kind: "message",
        data: {
          type: "next",
          id: "1",
          payload: {
            data: { pokemon_v2_version: [{ name: "red-v1" }] },
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
      defaultSubscriptionOptions: {
        reconnectionStrategy: 0, // Immediate
      },
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseAutoSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Wait for connection
  await waitFor(() => expect(screen.getByText("State: Connected")).toBeInTheDocument());
  expect(screen.getByText("Opens: 1")).toBeInTheDocument();
  expect(screen.getByText("Current Version: v1")).toBeInTheDocument();

  // Wait for data
  await waitFor(() => expect(screen.getByText("Data Count: 1")).toBeInTheDocument());
  expect(screen.getByText("Pokemon: red-v1")).toBeInTheDocument();
});

it("useAutoSubscription works with static variables", async () => {
  function TestUseAutoSubscription() {
    const [receivedData, setReceivedData] = React.useState<TestData[]>([]);

    const { state } = useAutoSubscription<TestData>(
      "subscription ($version: String!) { pokemon_v2_version(where: {name: {_eq: $version}}) { name } }",
      {
        variables: { version: "static-v1" },
        onData: (data) => {
          if (data.data) {
            setReceivedData((prev) => [...prev, data.data!]);
          }
        },
      },
    );

    return (
      <div>
        <p>State: {state}</p>
        <p>Data Count: {receivedData.length}</p>
        {receivedData.map((data, index) => (
          <div key={index}>
            {data.pokemon_v2_version.map((pokemon, pokemonIndex) => (
              <p key={pokemonIndex}>Pokemon: {pokemon.name}</p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Set up mock WebSocket expectations
  mockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

  mockWebSocket.expect(
    {
      id: "1",
      type: "subscribe",
      payload: {
        query: "subscription ($version: String!) { pokemon_v2_version(where: {name: {_eq: $version}}) { name } }",
        variables: { version: "static-v1" },
      },
    },
    [
      {
        kind: "message",
        data: {
          type: "next",
          id: "1",
          payload: {
            data: { pokemon_v2_version: [{ name: "static-red" }] },
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
      defaultSubscriptionOptions: {
        reconnectionStrategy: 0, // Immediate
      },
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseAutoSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Wait for connection
  await waitFor(() => expect(screen.getByText("State: Connected")).toBeInTheDocument());

  // Wait for data
  await waitFor(() => expect(screen.getByText("Data Count: 1")).toBeInTheDocument());
  expect(screen.getByText("Pokemon: static-red")).toBeInTheDocument();
});

it("useAutoSubscription handles reconnection after server close", async () => {
  function TestUseAutoSubscription() {
    const [receivedData, setReceivedData] = React.useState<TestData[]>([]);
    const [openCount, setOpenCount] = React.useState(0);
    const [closeCount, setCloseCount] = React.useState(0);

    const { state } = useAutoSubscription<TestData>("subscription { pokemon_v2_version { name } }", {
      onData: (data) => {
        if (data.data) {
          setReceivedData((prev) => [...prev, data.data!]);
        }
      },
      onOpen: () => {
        setOpenCount((prev) => prev + 1);
      },
      onClose: (reason) => {
        setCloseCount((prev) => prev + 1);
      },
    });

    return (
      <div>
        <p>State: {state}</p>
        <p>Opens: {openCount}</p>
        <p>Closes: {closeCount}</p>
        <p>Data Count: {receivedData.length}</p>
        {receivedData.map((data, index) => (
          <div key={index}>
            {data.pokemon_v2_version.map((pokemon, pokemonIndex) => (
              <p key={pokemonIndex}>Pokemon: {pokemon.name}</p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // Set up mock WebSocket expectations - first connection
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
            data: { pokemon_v2_version: [{ name: "first-connection" }] },
          },
        },
      },
      // Simulate server close
      { kind: "close" },
    ],
  );

  // Set up expectations for reconnection - will be handled by a new WebSocket instance
  const secondMockWebSocket = new MockWebSocket();

  secondMockWebSocket.expect({ type: "connection_init", payload: undefined }, [{ kind: "message", data: { type: "connection_ack" } }]);

  secondMockWebSocket.expect(
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
            data: { pokemon_v2_version: [{ name: "second-connection" }] },
          },
        },
      },
    ],
  );

  // Replace WebSocket constructor to return the second mock for reconnection
  let connectionCount = 0;
  (globalThis as any).WebSocket = jest.fn((url: string, protocol?: string) => {
    connectionCount++;
    if (connectionCount === 1) {
      mockWebSocket.initialize(url, protocol);
      return mockWebSocket as unknown as WebSocket;
    } else {
      secondMockWebSocket.initialize(url, protocol);
      return secondMockWebSocket as unknown as WebSocket;
    }
  });

  act(() => {
    const client = new GraphQLClient({
      url: "", // unused for subscriptions
      webSocketUrl: "ws://test/graphql",
      defaultSubscriptionOptions: {
        reconnectionStrategy: 0, // Immediate
      },
    });

    render(
      <GraphQLContext.Provider value={{ client }}>
        <TestUseAutoSubscription />
      </GraphQLContext.Provider>,
    );
  });

  // Wait for first connection
  await waitFor(() => expect(screen.getByText("State: Connected")).toBeInTheDocument());
  expect(screen.getByText("Opens: 1")).toBeInTheDocument();

  // Wait for first data
  await waitFor(() => expect(screen.getByText("Data Count: 1")).toBeInTheDocument());
  expect(screen.getByText("Pokemon: first-connection")).toBeInTheDocument();

  // Wait for reconnection attempt after server close
  await waitFor(() => expect(screen.getByText("State: Connecting")).toBeInTheDocument());
  await waitFor(() => expect(screen.getByText("Opens: 2")).toBeInTheDocument());

  // Wait for reconnection to complete
  await waitFor(() => expect(screen.getByText("State: Connected")).toBeInTheDocument());

  // Wait for second data packet
  await waitFor(() => expect(screen.getByText("Data Count: 2")).toBeInTheDocument());
  expect(screen.getByText("Pokemon: second-connection")).toBeInTheDocument();
});
