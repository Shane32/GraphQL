import IGraphQLError from "./IGraphQLError";

/**
 * Represents the result of a test query.
 *
 * @template TResult The type of the query result.
 */
interface ITestQueryResult<TResult> {
  /**
   * The data returned by the test query, if any.
   */
  data?: TResult;

  /**
   * Any errors returned by the test query, if any.
   */
  errors?: IGraphQLError[];
}

export default ITestQueryResult;
