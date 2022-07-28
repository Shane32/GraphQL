import { waitFor } from "@testing-library/react";
import sinon from "sinon";
import GraphQLClient from "../src/GraphQLClient"

let xhr: sinon.SinonFakeXMLHttpRequestStatic = null!;
let requests: sinon.SinonFakeXMLHttpRequest[] = [];
beforeEach(() => {
    xhr = sinon.useFakeXMLHttpRequest();
    xhr.onCreate = function (request) {
        requests.push(request);
    }
})

afterEach(() => {
    xhr.restore();
    requests = [];
})

test('executeQueryRaw', async () => {
    const client = new GraphQLClient({
        url: "https://api.zbox.com/api/graphql",
    });
    const ret = client.ExecuteQueryRaw<{ v1: { info: { version: string } } }>("{ v1 { info { version } } }")

    // simulate API call
    await waitFor(() => expect(requests.length).toEqual(1));
    expect(requests[0].url).toEqual("https://api.zbox.com/api/graphql");
    expect(requests[0].method).toEqual("POST");
    const formData = requests[0].requestBody as any as FormData;
    expect(formData.get("query")).toEqual("{ v1 { info { version } } }");
    requests[0].respond(200, { "Content-Type": "application/json" }, JSON.stringify({
        "data": {
            "v1": {
                "info": {
                    "version": "12345"
                }
            }
        }
    }));

    // verify result
    const result = await ret.result;
    expect(result.data).toBeTruthy();
    expect(result.data!.v1.info.version).toEqual("12345");
})

test('executeQuery', async () => {
    const client = new GraphQLClient({
        url: "https://api.zbox.com/api/graphql",
    });
    const ret = client.ExecuteQuery<{ v1: { info: { version: string } } }, null>("{ v1 { info { version } } }", null, "no-cache")

    expect(ret.result).toBeNull();
    expect(ret.loading).toBe(true);

    // simulate API call
    await waitFor(() => expect(requests.length).toEqual(1));
    expect(requests[0].url).toEqual("https://api.zbox.com/api/graphql");
    expect(requests[0].method).toEqual("POST");
    const formData = requests[0].requestBody as any as FormData;
    expect(formData.get("query")).toEqual("{ v1 { info { version } } }");
    requests[0].respond(200, { "Content-Type": "application/json" }, JSON.stringify({
        "data": {
            "v1": {
                "info": {
                    "version": "12345"
                }
            }
        }
    }));

    // verify result
    const result = await ret.resultPromise;
    expect(ret.loading).toBe(false);
    expect(ret.result).toBeTruthy();
    expect(ret.result).toBe(result);
    expect(result.data).toBeTruthy();
    expect(result.data!.v1.info.version).toEqual("12345");
})
