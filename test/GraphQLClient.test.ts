import { waitFor } from "@testing-library/react";
import GraphQLClient from "../src/GraphQLClient";
import CloseReason from "../src/CloseReason";
import { MockWebSocket } from "./MockWebSocket";

interface IMockFetch {
  request: Request;
  resolve: (value: Response | Promise<Response>) => void;
  reject: (reason?: any) => void;
}
let requests: IMockFetch[] = [];
let mockWebSocket: MockWebSocket;
let originalWebSocket: any;

beforeAll(() => {
  originalWebSocket = globalThis.WebSocket;
});

beforeEach(() => {
  jest.spyOn(global, "fetch").mockImplementation((request, init) => {
    return new Promise((resolve, reject) => {
      requests.push({
        request: new Request(request, init),
        resolve: resolve,
        reject: reject,
      });
    });
  });

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
  requests = [];
  mockWebSocket?.close?.();
  jest.restoreAllMocks();
});

afterAll(() => {
  (globalThis as any).WebSocket = originalWebSocket;
});

test("executeQueryRaw with json", async () => {
  const client = new GraphQLClient({
    url: "https://api.example.com/api/graphql",
  });
  const ret = client.executeQueryRaw<{ v1: { info: { version: string } } }>({
    query: "{ v1 { info { version } } }",
  });

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.example.com/api/graphql");
  expect(requests[0].request.method).toEqual("POST");
  const formData = await requests[0].request.json();
  expect(JSON.stringify(formData)).toEqual('{"query":"{ v1 { info { version } } }"}');
  requests[0].resolve(
    new Response(
      JSON.stringify({
        data: {
          v1: {
            info: {
              version: "12345",
            },
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );

  // verify result
  const result = await ret.result;
  expect(result.data).toBeTruthy();
  expect(result.data!.v1.info.version).toEqual("12345");
});

test("executeQueryRaw with json and alt response type", async () => {
  const client = new GraphQLClient({
    url: "https://api.example.com/api/graphql",
  });
  const ret = client.executeQueryRaw<{ v1: { info: { version: string } } }>({
    query: "{ v1 { info { version } } }",
  });

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.example.com/api/graphql");
  expect(requests[0].request.method).toEqual("POST");
  const formData = await requests[0].request.json();
  expect(JSON.stringify(formData)).toEqual('{"query":"{ v1 { info { version } } }"}');
  requests[0].resolve(
    new Response(
      JSON.stringify({
        data: {
          v1: {
            info: {
              version: "12345",
            },
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/graphql-response+json",
        },
      },
    ),
  );

  // verify result
  const result = await ret.result;
  expect(result.data).toBeTruthy();
  expect(result.data!.v1.info.version).toEqual("12345");
});

test("executeQueryRaw with form", async () => {
  const client = new GraphQLClient({
    url: "https://api.example.com/api/graphql",
    asForm: true,
  });
  const ret = client.executeQueryRaw<{ v1: { info: { version: string } } }>({
    query: "{ v1 { info { version } } }",
  });

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.example.com/api/graphql");
  expect(requests[0].request.method).toEqual("POST");
  const formData = await requests[0].request.formData();
  expect(formData.get("query")).toEqual("{ v1 { info { version } } }");
  requests[0].resolve(
    new Response(
      JSON.stringify({
        data: {
          v1: {
            info: {
              version: "12345",
            },
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );

  // verify result
  const result = await ret.result;
  expect(result.data).toBeTruthy();
  expect(result.data!.v1.info.version).toEqual("12345");
});

test("executeQuery", async () => {
  const client = new GraphQLClient({
    url: "https://api.example.com/api/graphql",
    asForm: true,
  });
  const ret = client.executeQuery<{ v1: { info: { version: string } } }>({ query: "{ v1 { info { version } } }" }, "no-cache");

  expect(ret.result).toBeNull();
  expect(ret.loading).toBe(true);

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.example.com/api/graphql");
  expect(requests[0].request.method).toEqual("POST");
  const formData = await requests[0].request.formData();
  expect(formData.get("query")).toEqual("{ v1 { info { version } } }");
  requests[0].resolve(
    new Response(
      JSON.stringify({
        data: {
          v1: {
            info: {
              version: "12345",
            },
          },
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );

  // verify result
  const result = await ret.resultPromise;
  expect(ret.loading).toBe(false);
  expect(ret.result).toBeTruthy();
  expect(ret.result).toBe(result);
  expect(result.data).toBeTruthy();
  expect(result.data!.v1.info.version).toEqual("12345");
});

test("executeSubscription", async () => {
  const client = new GraphQLClient({
    url: "", // unused
    webSocketUrl: "ws://test/graphql",
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
      payload: { query: "subscription { pokemon_v2_version { name } }" },
    },
    [
      {
        kind: "message",
        data: {
          type: "next",
          id: "1",
          payload: {
            data: { pokemon_v2_version: [{ name: "red" }, { name: "blue" }] },
          },
        },
      },
      { kind: "message", data: { type: "complete", id: "1" } },
    ],
  );

  const ret = client.executeSubscription<{ pokemon_v2_version: Array<{ name: string }> }>(
    {
      query: "subscription { pokemon_v2_version { name } }",
    },
    (data) => {
      if (data && data.data && data.data.pokemon_v2_version) receivedData = true;
    },
    (reason) => {
      receivedClose = true;
      closeReason = reason;
    },
  );

  await ret.connected;

  await waitFor(() => {
    expect(receivedData).toBeTruthy();
    expect(receivedClose).toBeTruthy();
    expect(closeReason).toBe(CloseReason.Server);
  });
});
