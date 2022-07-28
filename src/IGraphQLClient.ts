import IQueryResponse from "./IQueryResponse";
import IQueryResult from "./IQueryResult";

interface IGraphQLClient {
    GetPendingRequests: () => number;
    ExecuteQueryRaw: <T>(query: string, variables?: any) => { result: Promise<IQueryResult<T>>, abort: () => void };
    ExecuteQuery: <TReturn, TVariables>(query: string, variables?: TVariables | null, cacheMode?: "no-cache" | "cache-first" | "cache-and-network") => IQueryResponse<TReturn>;
    ExecuteSubscription: <TReturn, TVariables>(query: string, variables: TVariables | null, onData: (data: IQueryResult<TReturn>) => void, onClose: () => void) => { connected: Promise<void>, abort: () => void };
    RefreshAll: (force?: boolean) => void;
    ClearCache: () => void;
    ResetStore: () => void;
}

export default IGraphQLClient;
