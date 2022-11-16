import * as React from 'react'
import { render } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import GraphQLClient from '../src/GraphQLClient'
import GraphQLContext from '../src/GraphQLContext'
import useQuery from '../src/useQuery'
import { waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import * as sinon from 'sinon';

// https://reactjs.org/docs/testing-recipes.html

let xhr: sinon.SinonFakeXMLHttpRequestStatic = null!;
let requests: sinon.SinonFakeXMLHttpRequest[] = [];

beforeEach(() => {
    xhr = sinon.useFakeXMLHttpRequest();
    xhr.onCreate = function (request) {
        requests.push(request);
    }
})

afterEach(() => {
    // cleanup on exiting
    xhr.restore();
    xhr = null!;
    requests = [];
})

const StrictMode = (React as any).StrictMode ?? React.Fragment;

const useQueryTest = async (useStrictMode: boolean) => {
    act(() => {
        const client = new GraphQLClient({
            url: "https://api.zbox.com/api/graphql",
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
    await waitFor(() => expect(screen.getByText("Version: 12345")).toBeInTheDocument());

    function TestUseQuery() {
        const result = useQuery<{ v1: { info: { version: string } } }>("{ v1 { info { version } } }", { fetchPolicy: "no-cache" });
        return result.data ? <p>Version: {result.data.v1.info.version}</p> : <p>Loading</p>;
    }
}

it('useQuery works', () => useQueryTest(false));

//it('useQuery works with strict mode', () => useQueryTest(true));
