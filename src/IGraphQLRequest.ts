/**
 * Represents a GraphQL request with variables.
 *
 * @template TVariables The type of the variables.
 */
interface IGraphQLRequestWithArguments<TVariables> {
  /**
   * The GraphQL query string.
   */
  query?: string;

  /**
   * The document ID for the query.
   */
  documentId?: string;

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
  query?: string;

  /**
   * The document ID for the query.
   */
  documentId?: string;

  /**
   * The variables for the query, which should be null or an empty object for requests with no variables.
   */
  variables?: null | NoVariables;

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
type NoVariables = { [key: string]: never };

type IGraphQLRequest<TVariables = undefined> = TVariables extends undefined | NoVariables
  ? IGraphQLRequestNoArguments
  : IGraphQLRequestWithArguments<TVariables>;

export default IGraphQLRequest;
