/**
 * Represents a type decoration for a GraphQL document, associating the document's
 * result type and variables type. This ensures type safety when handling the query
 * results and variables, helping to catch potential mismatches at compile time.
 *
 * @template TResult - The expected shape of the result data from the GraphQL query.
 * @template TVariables - The expected shape of the variables passed into the query.
 */
interface DocumentTypeDecoration<TResult, TVariables> {
  /**
   * An optional function type used to enforce the relationship between the result type
   * and the variables type. While this function is never implemented, it provides
   * compile-time type checking to ensure variables conform to `TVariables` and the result
   * conforms to `TResult`.
   */
  __apiType?: (variables: TVariables) => TResult;
}

export default DocumentTypeDecoration;
