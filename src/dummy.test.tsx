//import * as React from 'react'
//import { render } from 'react-dom'
import { unmountComponentAtNode } from 'react-dom'
import { act } from 'react-dom/test-utils'
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

/*
it('should render the 2 of clubs', () => {
  act(() => {
    render(<Card card="2c" />, container);
  });
  const img = container.querySelector('img');
  expect(img?.src).toContain('2C.svg');
});
*/

it('dummy', () => {
  act(() => { });
})

/*
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
