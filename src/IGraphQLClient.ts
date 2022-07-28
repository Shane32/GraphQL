import IGraphQLRequest from "./IGraphQLRequest";
import IQueryResponse from "./IQueryResponse";
import IQueryResult from "./IQueryResult";

interface IGraphQLClient {
    GetPendingRequests: () => number;
    GetActiveSubscriptions: () => number;
    ExecuteQueryRaw: <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>) => { result: Promise<IQueryResult<TReturn>>, abort: () => void };
    ExecuteQuery: <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>, cacheMode?: "no-cache" | "cache-first" | "cache-and-network") => IQueryResponse<TReturn>;
    ExecuteSubscription: <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>, onData: (data: IQueryResult<TReturn>) => void, onClose: () => void) => { connected: Promise<void>, abort: () => void };
    RefreshAll: (force?: boolean) => void;
    ClearCache: () => void;
    ResetStore: () => void;
}

export default IGraphQLClient;
