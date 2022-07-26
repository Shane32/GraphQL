import * as React from 'react'
import { render } from 'react-dom'
import { unmountComponentAtNode } from 'react-dom'
import { act } from 'react-dom/test-utils'
import GraphQLClient from './GraphQLClient'
import GraphQLContext from './GraphQLContext'
import useQuery from './useQuery'
import { waitFor, screen } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
//import * as pretty from 'pretty'

// https://reactjs.org/docs/testing-recipes.html

let container: HTMLDivElement = null!
beforeEach(() => {
  // setup a DOM element as a render target
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  // cleanup on exiting
  unmountComponentAtNode(container)
  container.remove()
  container = null!
})

it('useQuery should work', async () => {
    act(() => {
        const client = new GraphQLClient({
            url: "https://api.zbox.com/api/graphql",
        });
        render(
            <GraphQLContext.Provider value={{ client }}>
                <TestUseQuery/>
            </GraphQLContext.Provider>,
            container);
    });
    await waitFor(() => expect(screen.getByTestId("version")).toBeInTheDocument());
});

function TestUseQuery()
{
    const result = useQuery<{ v1: { info: { version: string } } }>("{ v1 { info { version } } }", { fetchPolicy: "no-cache" });
    return result.data ? <p data-testid="version">Version: { result.data.v1.info.version }</p> : <p>Loading</p>;
}

/*
it('should render the 2 of clubs', () => {
  act(() => {
    render(<Card card="2c" />, container);
  });
  const img = container.querySelector('img');
  expect(img?.src).toContain('2C.svg');
});

it('should match snapshots', () => {
  act(() => {
    render(<Card card="2c" />, container)
  })

  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(
    `"<img src=\\"2C.svg\\" class=\\" playingcard playingcard_front\\" alt=\\"2c\\">"`
  ) // gets filled automatically by jest

  act(() => {
    render(<Card back />, container)
  })

  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(
    `"<img src=\\"back.svg\\" class=\\" playingcard playingcard_back\\" alt=\\"back\\">"`
  ) // gets filled automatically by jest

  act(() => {
    render(<Card back height={20} />, container)
  })

  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(
    `"<img src=\\"back.svg\\" class=\\" playingcard playingcard_back\\" alt=\\"back\\" style=\\"height: 20px;\\">"`
  ) // gets filled automatically by jest
})
*/
