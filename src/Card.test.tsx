import React from 'react'
import { render, unmountComponentAtNode } from 'react-dom'
import { act } from 'react-dom/test-utils'
import pretty from 'pretty'

// https://reactjs.org/docs/testing-recipes.html

import Card from './Card'

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

it('should render the 2 of clubs', () => {
  act(() => {
    render(<Card card="2c" />, container);
  });
  const img = container.querySelector('img');
  expect(img?.src).toContain('2C.svg');
});

it('should render the card back', () => {
  act(() => {
    render(<Card back />, container);
  });
  const img = container.querySelector('img');
  expect(img?.src).toContain('back.svg');
});

it('should render height', () => {
  act(() => {
    render(<Card back height={20} />, container);
  });
  const img = container.querySelector('img');
  expect(img?.style.height).toBe("20px");
});

it('should render height over specified style', () => {
  act(() => {
    render(<Card back height={20} style={{height: 10, width: 50}} />, container);
  });
  const img = container.querySelector('img');
  expect(img?.style.height).toBe("20px");
  expect(img?.style.width).toBe("50px");
});

it('should render style', () => {
  act(() => {
    render(<Card back style={{height: 10, width: 50}} />, container);
  });
  const img = container.querySelector('img');
  expect(img?.style.height).toBe("10px");
  expect(img?.style.width).toBe("50px");
});

it('should render default class', () => {
  act(() => {
    render(<Card card="2c" />, container);
  });
  let img = container.querySelector('img');
  expect(img?.className).toBe(" playingcard playingcard_front");

  act(() => {
    render(<Card back />, container);
  });
  img = container.querySelector('img');
  expect(img?.className).toBe(" playingcard playingcard_back");
});

it('should render specified class', () => {
  act(() => {
    render(<Card card="2c" className="hello" />, container);
  });
  let img = container.querySelector('img');
  expect(img?.className).toBe("hello playingcard playingcard_front");

  act(() => {
    render(<Card back className="hello" />, container);
  });
  img = container.querySelector('img');
  expect(img?.className).toBe("hello playingcard playingcard_back");
});

it('should match snapshots', () => {
  act(() => {
    render(<Card card="2c" />, container)
  })

  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(
    `"<img src=\\"2C.svg\\" class=\\" playingcard playingcard_front\\" alt=\\"2c\\">"`
  ) /* ... gets filled automatically by jest ... */

  act(() => {
    render(<Card back />, container)
  })

  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(
    `"<img src=\\"back.svg\\" class=\\" playingcard playingcard_back\\" alt=\\"back\\">"`
  ) /* ... gets filled automatically by jest ... */

  act(() => {
    render(<Card back height={20} />, container)
  })

  expect(pretty(container.innerHTML)).toMatchInlineSnapshot(
    `"<img src=\\"back.svg\\" class=\\" playingcard playingcard_back\\" alt=\\"back\\" style=\\"height: 20px;\\">"`
  ) /* ... gets filled automatically by jest ... */
})
