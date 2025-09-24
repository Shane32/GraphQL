/**
 * Client message type for outbound WebSocket messages
 */
type ClientMsg = {
  type: string;
  payload?: Record<string, any> | null;
  id?: string;
};

export default ClientMsg;
