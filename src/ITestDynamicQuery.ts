import IGraphQLRequest from "./IGraphQLRequest";
import ITestQueryResult from "./ITestQueryResult";

/**
 * Represents a test query with a dynamic result.
 * 
 * @template TResult The type of the query result.
 * @template TVariables The type of the query variables, if any.
 * @param request The GraphQL request for the test query.
 * @returns The dynamic result for the test query, or null if the query is not supported.
 */
type ITestDynamicQuery<TResult, TVariables = undefined> = (request: IGraphQLRequest<TVariables>) => ITestQueryResult<TResult> | null;

export default ITestDynamicQuery;
