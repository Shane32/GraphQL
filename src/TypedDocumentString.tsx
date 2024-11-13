import DocumentTypeDecoration from "./DocumentTypeDecoration";

/**
 * Represents a strongly-typed GraphQL document string that includes type information
 * for the query's result and variables. This extends the native `String` type, providing
 * additional type safety when working with GraphQL operations.
 *
 * @template TResult - The expected result type returned from the GraphQL query.
 * @template TVariables - The expected variables type accepted by the GraphQL query.
 */
interface TypedDocumentString<TResult, TVariables> extends String {
  /**
   * Inherits the `__apiType` property from `DocumentTypeDecoration`, ensuring
   * compatibility between the query's variables and result types.
   */
  __apiType?: DocumentTypeDecoration<TResult, TVariables>["__apiType"];

  /**
   * Overrides the `toString` method to return a string while retaining the associated
   * type information defined in `DocumentTypeDecoration`. This ensures that even when
   * treated as a string, the type metadata is preserved.
   *
   * @returns A string representation of the typed document with associated type decoration.
   */
  toString(): string & DocumentTypeDecoration<TResult, TVariables>;
}

export default TypedDocumentString;
