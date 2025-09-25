import ITestDynamicQuery from "./ITestDynamicQuery";
import ITestQuery from "./ITestQuery";
import TypedDocumentString from "./TypedDocumentString";

/**
 * Represents a configuration for testing GraphQL queries.
 */
interface IGraphQLTestConfig {
  /**
   * Adds a test query to the configuration.
   *
   * @template TResult The type of the query result.
   * @template TVariables The type of the query variables, if any.
   * @param arg The test query to add.
   */
  addTestQuery: <TResult, TVariables = undefined>(
    arg:
      | (ITestQuery<TResult, TVariables> & { query?: string })
      | (Omit<ITestQuery<TResult, TVariables>, "query"> & { query?: TypedDocumentString<TResult, TVariables> })
      | ITestDynamicQuery<TResult, TVariables>,
  ) => void;
}

export default IGraphQLTestConfig;
