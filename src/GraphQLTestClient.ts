import { IGraphQLClient, IGraphQLError, IQueryResponse, IQueryResult } from "./GraphQLClient";

function isFunction(functionToCheck: any) {
    return functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';
}

export type ITestQueryResult<TResult> = {
    data?: TResult,
    errors?: IGraphQLError[],
};

export interface ITestQuery<TResult, TVariables> {
    query: string,
    variables?: TVariables,
    result: ITestQueryResult<TResult>
};

export type ITestDynamicQuery<TResult, TVariables> = (arg: { query: string, variables?: TVariables, variablesJson: string | null }) => ITestQueryResult<TResult> | null;

export interface IGraphQLTestConfig {
    AddTestQuery: <TResult, TVariables>(arg: ITestQuery<TResult, TVariables> | ITestDynamicQuery<TResult, TVariables>) => void;
}

export default class GraphQLTestClient implements IGraphQLClient, IGraphQLTestConfig {
    private TestQueriesArray: Array<(arg: { query: string, variables?: any, variablesJson: string | null }) => any | null> = [];

    public AddTestQuery = <TResult, TVariables>(arg: ITestQuery<TResult, TVariables> | ITestDynamicQuery<TResult, TVariables>) => {
        if (isFunction(arg)) {
            const arg2 = arg as ((arg: { query: string, variables?: TVariables, variablesJson: string | null }) => TResult | null);
            this.TestQueriesArray = [
                arg2,
                ...this.TestQueriesArray
            ];
        }
        else {
            const arg2 = arg as { query: string, variables?: TVariables, result: TResult };
            const variablesJson = arg2.variables ? JSON.stringify(arg2.variables) : null;
            this.TestQueriesArray = [
                (input) => {
                    if (arg2.query === input.query && variablesJson === input.variablesJson)
                        return arg2.result;
                    return null;
                },
                ...this.TestQueriesArray
            ];
        }
    };

    public GetPendingRequests = () => 0;

    public ExecuteQueryRaw = <T>(query: string, variables?: any) => {
        const result: T = this.ExecuteTestQuery(query, variables);
        if (!result) {
            throw Error('No test configured for the requested query - "' + query + '" - ' + JSON.stringify(variables || null));
        }
        return {
            result: Promise.resolve(this.CreateQueryResult(result)),
            abort: () => { }
        };
    }

    private CreateQueryResult = <T>(result: T) => {
        let ret: IQueryResult<T>;
        if (result) {
            ret = {
                networkError: false,
                size: 0,
                ...result,
            };
        } else {
            ret = {
                networkError: true,
                size: 0,
                errors: [
                    {
                        message: "No test configured for the requested query",
                    }
                ],
            };
        }
        return ret;
    }

    public ExecuteQuery = <TReturn, TVariables>(query: string, variables?: TVariables | null, cacheMode?: "no-cache" | "cache-first" | "cache-and-network") => {
        var queryResult = this.ExecuteTestQuery<TReturn>(query, variables);
        if (!queryResult) {
            throw Error('No test configured for the requested query - "' + query + '" - ' + JSON.stringify(variables || null));
        }
        var result = this.CreateQueryResult(queryResult);
        var resultPromise = Promise.resolve(result);
        var ret: IQueryResponse<TReturn> = {
            result: result,
            forceRefresh: () => { },
            clearAndRefresh: () => { },
            loading: false,
            refresh: () => resultPromise,
            resultPromise: resultPromise,
            subscribe: () => () => { },
        };
        return ret;
    }

    public ExecuteTestQuery: <T>(query: string, variables?: any) => T = (query: string, variables?: any) => {
        const variablesJson = variables ? JSON.stringify(variables) : null;
        for (let i = 0; i < this.TestQueriesArray.length; i++) {
            var ret = this.TestQueriesArray[i]({
                query: query,
                variables: variables,
                variablesJson: variablesJson,
            });
            if (ret) return ret;
        }
        return null;
    }

    public RefreshAll = (force?: boolean) => { }

    public ClearCache = () => { }

    public ResetStore = () => { }
}
