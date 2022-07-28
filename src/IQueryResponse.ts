import IQueryResult from "./IQueryResult";

interface IQueryResponse<T> {
    resultPromise: Promise<IQueryResult<T>>, //executes either now or when the pending query (if any) has completed
    loading: boolean,
    result: IQueryResult<T> | null,
    subscribe: (callback: (result: IQueryResult<T> | null) => void) => (() => void), //returns a callback to release the subscription
    refresh: () => Promise<IQueryResult<T>>,
    forceRefresh: () => void,
    clearAndRefresh: () => void,
}

export default IQueryResponse;
