import IGraphQLClient from "./IGraphQLClient";
import IGraphQLRequest from "./IGraphQLRequest";
import IGraphQLTestConfig from "./IGraphQLTestConfig";
import IQueryResponse from "./IQueryResponse";
import IQueryResult from "./IQueryResult";
import ITestDynamicQuery from "./ITestDynamicQuery";
import ITestQuery from "./ITestQuery";
import ITestQueryResult from "./ITestQueryResult";

function isFunction(functionToCheck: any) {
    return (
        functionToCheck &&
        {}.toString.call(functionToCheck) === "[object Function]"
    );
}

/**
 * Represents a test client for a GraphQL API.
 *
 * @implements {IGraphQLClient}
 * @implements {IGraphQLTestConfig}
 */
export default class GraphQLTestClient
    implements IGraphQLClient, IGraphQLTestConfig
{
    private TestQueriesArray: Array<ITestDynamicQuery<any, any>> = [];

    public AddTestQuery = <TResult, TVariables = undefined>(
        arg:
            | ITestQuery<TResult, TVariables>
            | ITestDynamicQuery<TResult, TVariables>
    ) => {
        if (isFunction(arg)) {
            const arg2 = arg as ITestDynamicQuery<TResult, TVariables>;
            this.TestQueriesArray.push(arg2);
        } else {
            const arg2 = arg as ITestQuery<TResult, TVariables>;
            this.TestQueriesArray.push((input) => {
                if (
                    arg2.query === input.query &&
                    (arg2.operationName || null) ===
                        (input.operationName || null) &&
                    JSON.stringify(arg2.variables || null) ==
                        JSON.stringify(input.variables || null) &&
                    JSON.stringify(arg2.extensions || null) ==
                        JSON.stringify(input.extensions || null)
                )
                    return arg2.result;
                return null;
            });
        }
    };

    public GetPendingRequests = () => 0;

    public GetActiveSubscriptions = () => 0;

    public ExecuteQueryRaw = <TReturn, TVariables = undefined>(
        request: IGraphQLRequest<TVariables>
    ) => {
        const result = this.ExecuteTestQuery<TReturn, TVariables>(request);
        if (!result) {
            throw new Error(
                'No test configured for the requested query - "' +
                    request.query +
                    '" - ' +
                    JSON.stringify(request.variables || null)
            );
        }
        return {
            result: Promise.resolve(this.CreateQueryResult(result)),
            abort: () => {},
        };
    };

    private CreateQueryResult = <T>(result: ITestQueryResult<T>) => {
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
                    },
                ],
            };
        }
        return ret;
    };

    public ExecuteQuery = <TReturn, TVariables = undefined>(
        request: IGraphQLRequest<TVariables>,
        cacheMode?: "no-cache" | "cache-first" | "cache-and-network"
    ) => {
        var queryResult = this.ExecuteTestQuery<TReturn, TVariables>(request);
        if (!queryResult) {
            throw new Error(
                'No test configured for the requested query - "' +
                    request.query +
                    '" - ' +
                    JSON.stringify(request.variables || null)
            );
        }
        var result = this.CreateQueryResult(queryResult);
        var resultPromise = Promise.resolve(result);
        var ret: IQueryResponse<TReturn> = {
            result: result,
            forceRefresh: () => {},
            clearAndRefresh: () => {},
            loading: false,
            refresh: () => resultPromise,
            resultPromise: resultPromise,
            subscribe: () => () => {},
        };
        return ret;
    };

    public ExecuteTestQuery: <TReturn, TVariables>(
        request: IGraphQLRequest<TVariables>
    ) => ITestQueryResult<TReturn> | null = (request: IGraphQLRequest<any>) => {
        for (let i = this.TestQueriesArray.length - 1; i >= 0; i--) {
            var ret = this.TestQueriesArray[i](request);
            if (ret) return ret;
        }
        return null;
    };

    public RefreshAll = () => {};

    public ClearCache = () => {};

    public ResetStore = () => {};

    public ExecuteSubscription = () => {
        throw new Error("Subscriptions not supported in test environment");
    };
}
