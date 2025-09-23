// test-utils/MockWebSocket.ts
type Jsonish = string | Record<string, unknown>;

export type Action =
  | { kind: "message"; data: Jsonish; delayMs?: number }
  | { kind: "close"; code?: number; reason?: string; delayMs?: number };

type Expectation = {
  expectedJson: string;
  actions: {
    kind: "message" | "close";
    delayMs: number;
    dataJson?: string;
    code?: number;
    reason?: string;
  }[];
};

function stableStringify(v: any): string {
  if (typeof v === "string") return v;
  return JSON.stringify(v);
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

  private expectations: Expectation[] = [];

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
    setTimeout(() => this.triggerOpen(), 0);
  }

  /** Queue an expectation with a list of actions. */
  expect(expected: Jsonish, actions: Action[]) {
    const expectedJson = stableStringify(expected);
    const cooked: Expectation["actions"] = actions.map((a) =>
      a.kind === "message"
        ? {
            kind: "message",
            delayMs: a.delayMs ?? 0,
            dataJson: stableStringify(a.data),
          }
        : {
            kind: "close",
            delayMs: a.delayMs ?? 0,
            code: a.code ?? 1000,
            reason: a.reason ?? "mock-close",
          },
    );
    this.expectations.push({ expectedJson, actions: cooked });
  }

  /** Server-initiated push (unsolicited). */
  serverPush(data: Jsonish, delayMs = 0) {
    const dataJson = stableStringify(data);
    setTimeout(() => {
      if (this.readyState !== 1) return;
      this.onmessage?.({ data: dataJson });
    }, delayMs);
  }

  private triggerOpen() {
    if (this.readyState !== 0) return;
    this.readyState = 1; // OPEN
    this.onopen?.({});
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

    const idx = this.expectations.findIndex((e) => e.expectedJson === raw);
    if (idx === -1) {
      if (this.allowUnexpected) return;
      throw new Error(`MockWebSocket: unexpected packet received:\n${raw}\n(No matching expectation)`);
    }

    const [exp] = this.expectations.splice(idx, 1);

    let chainDelay = 0;
    for (const act of exp.actions) {
      chainDelay += act.delayMs ?? 0;

      if (act.kind === "message") {
        setTimeout(() => {
          if (this.readyState !== 1) return;
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
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code, reason });
  }
}
