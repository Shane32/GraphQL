import IGraphQLRequest from "./IGraphQLRequest";
import ClientMsg from "./ClientMsg";
import CloseReason from "./CloseReason";

/**
 * API provided to timeout strategies for interacting with the subscription.
 * This interface allows timeout strategies to control subscription lifecycle
 * and send messages through the WebSocket connection.
 *
 * @template TVariables - The type of variables used in the GraphQL request
 */
interface ITimeoutApi<TVariables = any> {
  /**
   * Safely sends a message to the server. This method will no-op (do nothing)
   * when the subscription has been aborted or the connection is closed.
   *
   * @param msg - The client message to send to the server
   */
  send: (msg: ClientMsg) => void;

  /**
   * Aborts the subscription with the specified reason. This will close
   * the subscription and prevent further message processing.
   *
   * @param reason - The reason for aborting the subscription
   */
  abort: (reason: CloseReason) => void;

  /**
   * The original GraphQL request that initiated this subscription.
   * Contains query, variables, and other request metadata.
   */
  request: IGraphQLRequest<TVariables>;

  /**
   * Connection-specific unique identifier for this subscription instance.
   * Used to correlate messages and manage subscription state.
   * May be the same as another subscriptionId made across a separate underlying connection.
   */
  subscriptionId: string;
}

export default ITimeoutApi;
