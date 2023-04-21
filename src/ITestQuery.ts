import IGraphQLRequest from "./IGraphQLRequest";
import ITestQueryResult from "./ITestQueryResult";

/**
 * Represents a test query with a fixed result.
 *
 * @template TResult The type of the query result.
 * @template TVariables The type of the query variables, if any.
 */
type ITestQuery<
    TResult,
    TVariables = undefined
> = IGraphQLRequest<TVariables> & {
    /**
     * The fixed result for the test query.
     */
    result: ITestQueryResult<TResult>;
};

export default ITestQuery;
