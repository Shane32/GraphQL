// test-utils/MockWebSocket.ts
type Jsonish = string | Record<string, unknown>;

export type Action =
  | { kind: "message"; data: Jsonish; delayMs?: number }
  | { kind: "close"; code?: number; reason?: string; delayMs?: number };

type ExpectationFunction = (actual: string) =>
  | {
      kind: "message" | "close";
      delayMs: number;
      dataJson?: string;
      code?: number;
      reason?: string;
    }[]
  | null;

function stableStringify(v: any): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v);
}

function matchesExpectation(actual: string, expected: string): boolean {
  try {
    const actualObj = JSON.parse(actual);
    const expectedObj = JSON.parse(expected);
    return deepMatch(actualObj, expectedObj);
  } catch {
    return actual === expected;
  }
}

function deepMatch(actual: any, expected: any): boolean {
  // Handle special "==ANY==" wildcard
  if (expected === "==ANY==") {
    return true;
  }

  // Handle Jest asymmetric matchers like expect.any(String)
  if (expected && typeof expected === "object" && typeof expected.asymmetricMatch === "function") {
    return expected.asymmetricMatch(actual);
  }

  if (typeof actual !== typeof expected) {
    return false;
  }

  if (actual === null || expected === null) {
    return actual === expected;
  }

  if (typeof actual !== "object") {
    return actual === expected;
  }

  if (Array.isArray(actual) !== Array.isArray(expected)) {
    return false;
  }

  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);

  if (actualKeys.length !== expectedKeys.length) {
    return false;
  }

  for (const key of expectedKeys) {
    if (!actualKeys.includes(key)) {
      return false;
    }
    if (!deepMatch(actual[key], expected[key])) {
      return false;
    }
  }

  return true;
}

export class MockWebSocket {
  static readonly DEFAULT_URL = "ws://test/graphql";
  static readonly SUBPROTOCOL = "graphql-transport-ws";

  url: string = MockWebSocket.DEFAULT_URL;
  protocol?: string = MockWebSocket.SUBPROTOCOL;
  readyState: number = 0; // CONNECTING

  onopen: ((ev?: any) => void) | null = null;
  onmessage: ((ev: { data: any }) => void) | null = null;
  onerror: ((ev?: any) => void) | null = null;
  onclose: ((ev?: { code: number; reason?: string }) => void) | null = null;

  /** If false (default), unexpected packets throw. If true, they're ignored. */
  allowUnexpected = false;

  private expectations: ExpectationFunction[] = [];

  constructor() {
    this.send = jest.fn(this._sendImpl.bind(this));
    this.close = jest.fn(this._closeImpl.bind(this));
  }

  initialize(url: string, protocol?: string) {
    if (url !== this.url) {
      throw new Error(`MockWebSocket: invalid url "${url}", expected "${this.url}"`);
    }
    if (protocol !== this.protocol) {
      throw new Error(`MockWebSocket: invalid protocol "${protocol}", expected "${MockWebSocket.SUBPROTOCOL}"`);
    }
    // Auto-open the connection
    setTimeout(() => {
      if (this.readyState !== 0) return; // not CONNECTING
      this.readyState = 1; // OPEN
      this.onopen?.({});
    }, 0);
  }

  /** Queue an expectation with a list of actions. */
  expect(expected: Jsonish, actions: Action[]) {
    const expectedJson = stableStringify(expected);
    const cooked = actions.map((a) =>
      a.kind === "message"
        ? {
            kind: "message" as const,
            delayMs: a.delayMs ?? 0,
            dataJson: stableStringify(a.data),
          }
        : {
            kind: "close" as const,
            delayMs: a.delayMs ?? 0,
            code: a.code ?? 1000,
            reason: a.reason ?? "mock-close",
          },
    );

    // Convert static expectation to function
    this.expectations.push((actual: string) => {
      return matchesExpectation(actual, expectedJson) ? cooked : null;
    });
  }

  /** Queue a function-based expectation that can generate dynamic responses. */
  expectFunction(actionGenerator: (actual: string) => Action[] | null) {
    this.expectations.push((actual: string) => {
      const actions = actionGenerator(actual);
      if (!actions) return null;
      return actions.map((a) =>
        a.kind === "message"
          ? {
              kind: "message" as const,
              delayMs: a.delayMs ?? 0,
              dataJson: stableStringify(a.data),
            }
          : {
              kind: "close" as const,
              delayMs: a.delayMs ?? 0,
              code: a.code ?? 1000,
              reason: a.reason ?? "mock-close",
            },
      );
    });
  }

  /** Server-initiated push (unsolicited). */
  serverPush(data: Jsonish, delayMs = 0) {
    const dataJson = stableStringify(data);
    setTimeout(() => {
      if (this.readyState !== 1) return; // not OPEN
      this.onmessage?.({ data: dataJson });
    }, delayMs);
  }

  // assigned in ctor
  send: (data: any) => void;
  close: (code?: number, reason?: string) => void;

  // ---- internals ----
  private _sendImpl(raw: any) {
    if (typeof raw !== "string") {
      if (!this.allowUnexpected) {
        throw new Error(`MockWebSocket: expected client to send TEXT, got non-string: ${String(raw)}`);
      }
      return;
    }

    let actions: ReturnType<ExpectationFunction> = null;
    let matchedIdx = -1;

    for (let i = 0; i < this.expectations.length; i++) {
      actions = this.expectations[i](raw);
      if (actions !== null) {
        matchedIdx = i;
        break;
      }
    }

    if (matchedIdx === -1) {
      if (this.allowUnexpected) return;
      throw new Error(`MockWebSocket: unexpected packet received:\n${raw}\n(No matching expectation)`);
    }

    // Remove the matched expectation
    this.expectations.splice(matchedIdx, 1);

    if (!actions) return;

    let chainDelay = 0;
    for (const act of actions) {
      chainDelay += act.delayMs ?? 0;

      if (act.kind === "message") {
        setTimeout(() => {
          if (this.readyState !== 1) return; // not OPEN
          this.onmessage?.({ data: act.dataJson });
        }, chainDelay);
      } else if (act.kind === "close") {
        setTimeout(() => {
          this._closeImpl(act.code!, act.reason!);
        }, chainDelay);
      }
    }
  }

  private _closeImpl(code: number = 1000, reason: string = "mock-close") {
    if (this.readyState === 3) return; // already CLOSED
    this.readyState = 3; // CLOSED
    this.onclose?.({ code, reason });
  }
}
