import * as React from "react";
import { render } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import GraphQLClient from "../src/GraphQLClient";
import GraphQLContext from "../src/GraphQLContext";
import useQuery from "../src/useQuery";
import { waitFor, screen } from "@testing-library/react";
import "@testing-library/jest-dom/extend-expect";

// https://reactjs.org/docs/testing-recipes.html

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

const StrictMode = (React as any).StrictMode ?? React.Fragment;

const useQueryTest = async (useStrictMode: boolean, count: number, fetchPolicy: "no-cache" | "cache-first" | "cache-and-network") => {
    act(() => {
        const client = new GraphQLClient({
            url: "https://api.zbox.com/api/graphql",
            asForm: true,
        });
        if (useStrictMode) {
            render(
                <StrictMode>
                    <GraphQLContext.Provider value={{ client }}>
                        <TestUseQuery />
                    </GraphQLContext.Provider>
                </StrictMode>
            );
        } else {
            render(
                <GraphQLContext.Provider value={{ client }}>
                    <TestUseQuery />
                </GraphQLContext.Provider>
            );
        }
    });
    await waitFor(() => expect(screen.getByText("Loading")).toBeInTheDocument());
    await waitFor(() => expect(requests.length).toEqual(count));
    for (let i = 0; i < count; i++) {
        expect(requests[i].request.url).toEqual("https://api.zbox.com/api/graphql");
        expect(requests[i].request.method).toEqual("POST");
        const formData = await requests[i].request.formData();
        expect(formData.get("query")).toEqual("{ v1 { info { version } } }");
        requests[i].resolve(
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
                }
            )
        );
    }
    await waitFor(() => expect(screen.getByText("Version: 12345")).toBeInTheDocument());

    function TestUseQuery() {
        const result = useQuery<{ v1: { info: { version: string } } }>("{ v1 { info { version } } }", { fetchPolicy: fetchPolicy });
        return result.data ? <p>Version: {result.data.v1.info.version}</p> : <p>Loading</p>;
    }
};

it("useQuery works", () => useQueryTest(false, 1, "no-cache"));

it("useQuery works with strict mode", () => useQueryTest(true, 2, "no-cache"));
it("useQuery works with strict mode, cache-first", () => useQueryTest(true, 1, "cache-first"));
it("useQuery works with strict mode, cache-and-network", () => useQueryTest(true, 1, "cache-and-network"));
