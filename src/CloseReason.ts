enum CloseReason {
  /** Client explicitly unsubscribed or closed the WebSocket */
  Client = "Client",

  /** Server ended the subscription cleanly */
  Server = "Server",

  /** Network/protocol error or unexpected disconnect */
  Error = "Error",

  /** Heartbeat/keep-alive missed */
  Timeout = "Timeout",
}

export default CloseReason;
