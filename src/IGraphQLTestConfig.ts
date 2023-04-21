import ITestDynamicQuery from "./ITestDynamicQuery";
import ITestQuery from "./ITestQuery";

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
    AddTestQuery: <TResult, TVariables = undefined>(
        arg:
            | ITestQuery<TResult, TVariables>
            | ITestDynamicQuery<TResult, TVariables>
    ) => void;
}

export default IGraphQLTestConfig;
