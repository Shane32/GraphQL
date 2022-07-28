import * as React from 'react';
import GraphQLError from './GraphQLError';
import IGraphQLClient from './IGraphQLClient';
import IGraphQLError from './IGraphQLError';
import IGraphQLRequest from './IGraphQLRequest';
import IQueryResponse from './IQueryResponse';
import IQueryResult from './IQueryResult';
import useGraphQLClient from './useGraphQLClient';

type IUseQueryRet<TResult, TVariables> = {
    data?: TResult | null,
    errors?: Array<IGraphQLError>,
    error?: GraphQLError,
    extensions?: any,
    networkError?: boolean,
    loading: boolean,
    refetch: (variables?: TVariables) => Promise<IQueryResult<TResult>>,
};

interface IOptions<TResult, TVariables> {
    guest?: boolean,
    client?: IGraphQLClient | string,
    fetchPolicy?: "cache-first" | "no-cache" | "cache-and-network",
    onCompleted?: (data: TResult) => void,
    onError?: (e: GraphQLError) => void,
    skip?: boolean,
    autoRefetch?: boolean,
    variables?: TVariables,
    operationName?: string,
    extensions?: {} | null,
}

interface IUseQuery {
    <TResult, TVariables>(query: string, options: IOptions<TResult, TVariables>): IUseQueryRet<TResult, TVariables>;
    <TResult>(query: string, options?: IOptions<TResult, never>): IUseQueryRet<TResult, never>
}

const useQuery: IUseQuery = <TResult, TVariables>(query: string, options?: IOptions<TResult, TVariables>) => {
    // return true the first time this method executes; false afterwards
    const firstRunRef = React.useRef<boolean>(true);
    // currentOnCompleted holds a reference to the most recently updated
    //   delegate for the onCompleted event
    const currentOnCompleted = React.useRef<((data: TResult) => void) | undefined>();
    currentOnCompleted.current = options?.onCompleted;
    // currentOnError holds a reference to the most recently updated
    //   delegate for the onError event
    const currentOnError = React.useRef<((e: GraphQLError) => void) | undefined>();
    currentOnError.current = options?.onError;

    // cleanupRef always executes when useQuery is unloaded
    const cleanupRef = React.useRef<(() => void) | null>(null as any);
    const client = useGraphQLClient(options && options.client, options && options.guest);

    // call rerender() within a callback to cause a rerender of the page
    const [, setRerender] = React.useState<{}>({});
    const rerender = () => setRerender({});

    const createQueryResponse = (variables?: TVariables) => {
        const request: IGraphQLRequest<TVariables> = {
            query,
            variables: (variables || options?.variables) as any,
            operationName: options?.operationName,
            extensions: options?.extensions,
        };
        if (cleanupRef.current) console.error("cleanupRef already created for createQueryResponse");
        const ret = client.ExecuteQuery<TResult, TVariables>(request, options?.fetchPolicy || "cache-first");
        cleanupRef.current = ret.subscribe(newData => {
            lastDataRef.current = newData;
            rerender();
        });
        return ret;
    }

    // lastQuery holds the current query that should be executed.
    //   If 'options.autoRefetch' is true, then this will be updated when 'query' is changed.
    //   If it is false, changing 'query' has no effect unless refetch is called (but still this variable will not change).
    //   The query cannot be changed by the 'refetch' delegate.
    const lastQuery = React.useRef<string>(query);
    // lastVariables1 holds the variables specified within 'options.variables'.
    //   If 'options.autoRefetch' is true, then this will be updated when 'options.variables' is changed.
    //   If 'options.autoRefetch' is false, changing 'options.variables' has no effect unless refetch is called (but still this variable will not change).
    const lastVariables1 = React.useRef<TVariables | null | undefined>(options?.variables);
    // A stringified version of lastVariables1
    const lastVariables2 = React.useRef<string | null>(options?.variables ? JSON.stringify(options.variables) : null);

    // Contains the reference to the underlying query response
    const queryResponseRef = React.useRef<IQueryResponse<TResult> | null>(null);
    const lastDataRef = React.useRef<IQueryResult<TResult> | null>(null);

    // Unloads the currently loaded response and clears state
    const clear = () => {
        if (queryResponseRef.current === null) return;
        if (cleanupRef.current) {
            //console.log("cleanupRefOLD - refresh", cleanupRef.current);
            cleanupRef.current();
            cleanupRef.current = null;
        }
        queryResponseRef.current = null;
        lastDataRef.current = null;
        //do not call rerender here
    }

    // Remembers the actual last query/variables that were executed (since calling refetch can change variables)
    const queriedQuery = React.useRef<string>(lastQuery.current);
    const queriedVariables = React.useRef<string | null>(lastVariables2.current);

    // Triggers loading if no query executed yet.
    // Does nothing if the query is currently loading.
    // Unloads the old query and runs a new query if the query or variables are different.
    // Refetches the existing query if the query and variables are the same.
    const refresh = (variables?: TVariables) => {
        // determine if the query that needs to execute is different than the one that ran last time
        variables = (variables || options?.variables) as any;
        const variablesStr = variables ? JSON.stringify(variables) : null;
        let differentQuery =
            !queryResponseRef.current ||                   // if no query executed yet
            queriedQuery.current !== query ||              // if the query is different
            queriedVariables.current !== variablesStr;     // if the variables are different

        queriedQuery.current = query;
        queriedVariables.current = variablesStr;

        let ret: Promise<IQueryResult<TResult>>;
        if (differentQuery) {
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            }
            queryResponseRef.current = createQueryResponse(variables);
            ret = queryResponseRef.current.resultPromise;
            lastDataRef.current = queryResponseRef.current?.result || null;
        }
        else {
            ret = queryResponseRef.current!.refresh();
        }
        //do not rerender here (call refreshWithRerender if a rerender is necessary)
        return ret.then(
            (data) => {
                if (data.data && !(data.errors && data.errors.length))
                    return Promise.resolve(data);
                return Promise.reject(new GraphQLError(data));
            });
    };

    const refreshWithRerender = (variables?: TVariables) => {
        //console.log('useQuery - refetch', query, options, variables);
        const ret = refresh(variables);
        rerender();
        return ret;
    }

    // ========= Main code ============
    // Start by determining if we need to execute a refresh() or clear() or similar
    if (!queryResponseRef.current) {
        if (options?.autoRefetch ?? true) {
            lastQuery.current = query;
            if (lastVariables1.current !== options?.variables) {
                lastVariables1.current = options?.variables;
                lastVariables2.current = options?.variables ? JSON.stringify(options.variables) : null;
            }
        }
        //console.log("RUNNING createQueryResponse");
        queryResponseRef.current = options?.skip ? null : createQueryResponse();
        lastDataRef.current = queryResponseRef.current?.result || null;
    }
    else {
        if (options?.autoRefetch ?? true) {
            let needsRefresh = false;
            // check if the query is different
            if (lastQuery.current !== query) {
                // save the updated query reference
                needsRefresh = true;
                lastQuery.current = query;
            }
            // check if the variables are different
            // perform a reference check first
            if (lastVariables1.current !== options?.variables) {
                // if the reference is different, use JSON.stringify to perform a deep comparison
                const newVariablesStr = options?.variables ? JSON.stringify(options.variables) : null;
                if (lastVariables2.current !== newVariablesStr) {
                    // save the updated variables reference
                    needsRefresh = true;
                    lastVariables2.current = newVariablesStr;
                }
                lastVariables1.current = options?.variables;
            }
            // if query or variables are different, either perform a refresh if skip is false, or clear if skip is true
            if (needsRefresh) {
                if (options?.skip) {
                    //console.log('useQuery - clear', query, options);
                    clear();
                }
                else {
                    //console.log('useQuery - refresh', query, options);
                    refresh();
                }
            }
        }
    }

    // Executes the onCompleted or onError event handler the first time the data is loaded.
    // Does not execute a second time, unless everything was unloaded due to skip=true and new query/variables
    //   being set, and then skip=false or refetch() was called.
    const anyQueryResponse = !!queryResponseRef.current;
    React.useEffect(() => {
        const queryResponse = queryResponseRef.current;
        if (queryResponse) {
            queryResponse.resultPromise.then((data) => {
                if (!data.errors?.length && data.data) {
                    if (currentOnCompleted.current)
                        currentOnCompleted.current(data.data);
                } else {
                    if (currentOnError.current)
                        currentOnError.current(new GraphQLError(data));
                }
            });
        }
    }, [anyQueryResponse]);

    // an effect that only runs/unloads once
    React.useEffect(() => {
        return () => {
            // only run this code once, when the hook is unloaded
            //console.log("cleanupRefOLD - CLEANUP", cleanupRef.current);
            if (cleanupRef.current) {
                cleanupRef.current();
                cleanupRef.current = null;
            };
        };
    }, []);

    firstRunRef.current = false;

    // ==== create & return state ====
    const data = lastDataRef.current;
    const queryResponse = queryResponseRef.current;
    let ret: IUseQueryRet<TResult, TVariables>;
    if (!queryResponse) {
        ret = {
            loading: false,
            refetch: refreshWithRerender,
        };
    }
    else {
        const anyErrors = !!(data && data.errors && data.errors.length);
        if (queryResponse.loading && anyErrors)
            ret = {
                loading: true,
                refetch: refreshWithRerender,
            };
        else
            ret = {
                ...data,
                error: data && anyErrors ? new GraphQLError(data) : undefined,
                loading: queryResponse.loading,
                refetch: refreshWithRerender,
            };
    }

    /*
    console.log('useQuery', {
        query: query,
        options: options,
        firstRunRef: firstRunRef.current,
        cleanupRefSet: !!cleanupRef.current,
        client: client,
        lastQuery: lastQuery.current,
        lastVariables1: lastVariables1.current,
        lastVariables2: lastVariables2.current,
        queryResponseRef: queryResponseRef.current,
        lastDataRef: lastDataRef.current,
        queriedQuery: queriedQuery.current,
        queriedVariables: queriedVariables.current,
    }, ret);
    */

    return ret;
};

export default useQuery;
