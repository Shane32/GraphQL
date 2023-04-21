import IGraphQLError from "./IGraphQLError";
import IQueryResult from "./IQueryResult";

/**
 * Represents an JavaScript exception that occurs during a GraphQL query.
 */
export default class GraphQLError {
    /**
     * The GraphQL errors returned by the query, if any.
     */
    public graphQLErrors: Array<IGraphQLError> | undefined;

    /**
     * The network error returned by the query, if any.
     */
    public networkError: any;

    /**
     * The error message for the query.
     */
    public message: string;

    /**
     * The response for the query that caused the error.
     */
    public response: IQueryResult<any>;

    /**
     * Creates a new `GraphQLError` instance with the specified query response.
     *
     * @param data The response for the query that caused the error.
     */
    public constructor(data: IQueryResult<any>) {
        this.response = data;

        // Set the error message based on the response
        this.message = data.errors && data.errors.length ? data.errors[0].message : "Unknown error";
        if (!data.networkError) {
            this.graphQLErrors = data.errors;
        }
    }
}
