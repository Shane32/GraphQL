/**
 * Client message type for outbound WebSocket messages
 */
type ClientMsg = {
  type: string;
  payload?: any;
  id?: string;
};

export default ClientMsg;
