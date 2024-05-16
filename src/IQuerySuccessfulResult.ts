/**
 * Represents the result of a GraphQL query that has executed without any errors.
 *
 * @template T The type of the query result.
 */
interface IQuerySuccessfulResult<T> {
  /**
   * The data returned by the query, or null if there was an error, or undefined if the request was not executed.
   */
  data: T;

  /**
   * Additional extensions for the query result.
   */
  extensions?: any;

  /**
   * Indicates whether there was a network error.
   */
  networkError: false;

  /**
   * The size of the query result in bytes.
   */
  size: number;
}

export default IQuerySuccessfulResult;
