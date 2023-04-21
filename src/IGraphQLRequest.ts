/**
 * Represents a GraphQL request with variables.
 *
 * @template TVariables The type of the variables.
 */
interface IGraphQLRequestWithArguments<TVariables> {
    /**
     * The GraphQL query string.
     */
    query: string;

    /**
     * The variables for the query.
     */
    variables: TVariables;

    /**
     * Additional extensions for the query.
     */
    extensions?: {} | null;

    /**
     * The name of the operation in the query.
     */
    operationName?: string;
}

/**
 * Represents a GraphQL request with no variables.
 */
interface IGraphQLRequestNoArguments {
    /**
     * The GraphQL query string.
     */
    query: string;

    /**
     * The variables for the query, which should be null for requests with no variables.
     */
    variables?: null;

    /**
     * Additional extensions for the query.
     */
    extensions?: {} | null;

    /**
     * The name of the operation in the query.
     */
    operationName?: string;
}

/**
 * Represents a GraphQL request, which can have either variables or no variables.
 *
 * @template TVariables The type of the variables, if any.
 */
type IGraphQLRequest<TVariables = undefined> = TVariables extends undefined
    ? IGraphQLRequestNoArguments
    : IGraphQLRequestWithArguments<TVariables>;

export default IGraphQLRequest;
