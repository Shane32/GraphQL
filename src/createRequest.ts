import IGraphQLRequest from "./IGraphQLRequest";
import TypedDocumentString from "./TypedDocumentString";

/**
 * Creates a GraphQL request object from a query and options.
 *
 * @template TResult The expected result type of the query.
 * @template TVariables The expected variables type of the query.
 * @param query The GraphQL query string or TypedDocumentString.
 * @param options Optional configuration for the request.
 * @param options.variables The variables for the query.
 * @param options.extensions Additional extensions for the query.
 * @param options.operationName The name of the operation in the query.
 * @returns An object conforming to IGraphQLRequest.
 */
function createRequest<TResult, TVariables = unknown>(
  query: string | TypedDocumentString<TResult, TVariables>,
  options?: {
    variables?: TVariables;
    extensions?: {} | null;
    operationName?: string;
  },
): IGraphQLRequest<TVariables> {
  // Extract documentId if query is a TypedDocumentString
  const documentId = (query as TypedDocumentString<TResult, TVariables>).__meta__?.hash;

  // Convert query to string if it's not using a documentId
  const queryString = documentId ? undefined : query.toString();

  // Construct the request object
  const request: IGraphQLRequest<TVariables> = {
    query: queryString,
    documentId: documentId,
    variables: options?.variables,
    extensions: options?.extensions,
    operationName: options?.operationName,
  } as any;

  return request;
}

export default createRequest;
