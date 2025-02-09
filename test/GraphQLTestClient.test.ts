import { waitFor } from "@testing-library/react";
import GraphQLClient from "../src/GraphQLClient";
import GraphQLTestClient from "../src/GraphQLTestClient";
import TypedDocumentString from "../src/TypedDocumentString";

interface IMockFetch {
  request: Request;
  resolve: (value: Response | Promise<Response>) => void;
  reject: (reason?: any) => void;
}
let requests: IMockFetch[] = [];

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
});

afterEach(() => {
  requests = [];
});

test("executeQueryRaw with json", async () => {
  const client = new GraphQLClient({
    url: "https://api.zbox.com/api/graphql",
  });
  const ret = client.ExecuteQueryRaw<{ v1: { info: { version: string } } }>({
    query: "{ v1 { info { version } } }",
  });

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.zbox.com/api/graphql");
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
    url: "https://api.zbox.com/api/graphql",
  });
  const ret = client.ExecuteQueryRaw<{ v1: { info: { version: string } } }>({
    query: "{ v1 { info { version } } }",
  });

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.zbox.com/api/graphql");
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
    url: "https://api.zbox.com/api/graphql",
    asForm: true,
  });
  const ret = client.ExecuteQueryRaw<{ v1: { info: { version: string } } }>({
    query: "{ v1 { info { version } } }",
  });

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.zbox.com/api/graphql");
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
    url: "https://api.zbox.com/api/graphql",
    asForm: true,
  });
  const ret = client.ExecuteQuery<{ v1: { info: { version: string } } }>({ query: "{ v1 { info { version } } }" }, "no-cache");

  expect(ret.result).toBeNull();
  expect(ret.loading).toBe(true);

  // simulate API call
  await waitFor(() => expect(requests.length).toEqual(1));
  expect(requests[0].request.url).toEqual("https://api.zbox.com/api/graphql");
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

test("GraphQLTestClient with TypedDocumentString using hash", () => {
  const client = new GraphQLTestClient();
  const document = {
    __meta__: { hash: "myhash" },
    toString: () => "{ test { field } }",
  } as TypedDocumentString<{ test: { field: string } }, {}>;

  client.AddTestQuery({
    query: document,
    variables: {},
    result: { data: { test: { field: "value" } } },
  });

  // Test matching with documentId
  const result1 = client.ExecuteTestQuery<{ test: { field: string } }, {}>({
    documentId: "myhash",
    variables: {},
  });
  expect(result1?.data?.test.field).toBe("value");

  // Test non-matching documentId
  const result2 = client.ExecuteTestQuery({
    documentId: "wronghash",
    variables: {},
  });
  expect(result2).toBeNull();
});

test("GraphQLTestClient with TypedDocumentString using query string", () => {
  const client = new GraphQLTestClient();
  const document = {
    toString: () => "{ test { field } }",
  } as TypedDocumentString<{ test: { field: string } }, {}>;

  client.AddTestQuery({
    query: document,
    variables: {},
    result: { data: { test: { field: "value" } } },
  });

  // Test exact match
  const result1 = client.ExecuteTestQuery<{ test: { field: string } }, {}>({
    query: "{ test { field } }",
    variables: {},
  });
  expect(result1?.data?.test.field).toBe("value");

  // Test non-matching query
  const result2 = client.ExecuteTestQuery({
    query: "{ other { field } }",
    variables: {},
  });
  expect(result2).toBeNull();
});

test("GraphQLTestClient with TypedDocumentString using MatchAnyPart", () => {
  const client = new GraphQLTestClient();
  client.MatchAnyPart = true;
  const document = {
    toString: () => "{ test { field } }",
  } as TypedDocumentString<{ test: { field: string } }, {}>;

  client.AddTestQuery({
    query: document,
    variables: {},
    result: { data: { test: { field: "value" } } },
  });

  // Test partial match with different formatting
  const result1 = client.ExecuteTestQuery<{ test: { field: string } }, {}>({
    query: "{test{field}}",
    variables: {},
  });
  expect(result1?.data?.test.field).toBe("value");

  // Test non-matching query
  const result2 = client.ExecuteTestQuery({
    query: "{ other { field } }",
    variables: {},
  });
  expect(result2).toBeNull();
});
