import IGraphQLError from "./IGraphQLError";

/**
 * Represents the result of a GraphQL query.
 *
 * @template T The type of the query result.
 */
interface IQueryResult<T> {
    /**
     * The data returned by the query, or null if there was an error, or undefined if the request was not executed.
     */
    data?: T | null;

    /**
     * Any errors returned by the query, if any.
     */
    errors?: Array<IGraphQLError>;

    /**
     * Additional extensions for the query result.
     */
    extensions?: any;

    /**
     * Indicates whether there was a network error.
     */
    networkError: boolean;

    /**
     * The size of the query result in bytes.
     */
    size: number;
}

export default IQueryResult;
