import IGraphQLError from "./IGraphQLError";

interface ConnectionInitMessage {
  type: "connection_init";
  payload?: Record<string, unknown> | null;
}

interface ConnectionAckMessage {
  type: "connection_ack";
  payload?: Record<string, unknown> | null;
}

interface PingMessage {
  type: "ping";
  payload?: Record<string, unknown> | null;
}

interface PongMessage {
  type: "pong";
  payload?: Record<string, unknown> | null;
}

interface SubscribeMessage {
  id: string;
  type: "subscribe";
  payload: {
    operationName?: string | null;
    query: string;
    variables?: Record<string, unknown> | null;
    extensions?: Record<string, unknown> | null;
  };
}

interface NextMessage<T> {
  id: string;
  type: "next";
  payload: {
    data?: T | null;
    errors?: IGraphQLError[];
    extensions?: Record<string, unknown>;
  };
}

interface ErrorMessage {
  id: string;
  type: "error";
  payload: IGraphQLError[];
}

interface CompleteMessage {
  id: string;
  type: "complete";
}

type IWebSocketMessage<T> =
  | ConnectionInitMessage
  | ConnectionAckMessage
  | PingMessage
  | PongMessage
  | SubscribeMessage
  | NextMessage<T>
  | ErrorMessage
  | CompleteMessage;

export default IWebSocketMessage;
