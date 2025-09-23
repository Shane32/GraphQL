import IGraphQLRequest from "./IGraphQLRequest";
import ClientMsg from "./ClientMsg";
import CloseReason from "./CloseReason";

/**
 * API provided to timeout strategies for interacting with the subscription
 */
interface ITimeoutApi<TVariables = any> {
  /** Safe send that no-ops when aborted/closed. */
  send: (msg: ClientMsg) => void;

  /** Abort the subscription with a reason. */
  abort: (reason: CloseReason) => void;

  /** Useful metadata */
  request: IGraphQLRequest<TVariables>;
  subscriptionId: string;
}

export default ITimeoutApi;
