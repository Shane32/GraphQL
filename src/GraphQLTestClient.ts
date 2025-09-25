import IGraphQLClient from "./IGraphQLClient";
import IGraphQLRequest from "./IGraphQLRequest";
import IGraphQLTestConfig from "./IGraphQLTestConfig";
import IQueryResponse from "./IQueryResponse";
import IQueryResult from "./IQueryResult";
import ITestDynamicQuery from "./ITestDynamicQuery";
import ITestQuery from "./ITestQuery";
import ITestQueryResult from "./ITestQueryResult";
import TypedDocumentString from "./TypedDocumentString";

// Import parse and print from the graphql package
import { parse, print, DocumentNode, OperationDefinitionNode } from "graphql";

function isFunction(functionToCheck: any) {
  return functionToCheck && {}.toString.call(functionToCheck) === "[object Function]";
}

/**
 * Given a parsed GraphQL document and an optional operation name,
 * returns the proper operation definition.
 *
 * If an operation name is given, it is used to select the proper
 * operation; otherwise, if there is exactly one operation, that one is used.
 * (If there are multiple operations and no name is given, we fall back to
 * returning the first one.)
 */
function extractOperation(document: DocumentNode, operationName?: string | null): OperationDefinitionNode | null {
  const operations = document.definitions.filter((def) => def.kind === "OperationDefinition") as OperationDefinitionNode[];
  if (operationName) {
    return operations.find((op) => op.name && op.name.value === operationName) || null;
  } else {
    return operations.length === 1 ? operations[0] : operations[0] || null;
  }
}

/**
 * Compares two GraphQL query documents based on their parsed operations.
 * It extracts the operation corresponding to the provided operationName (if any) and
 * checks if the input's operation string includes the test's operation string.
 * If parsing fails, it falls back to simple trimmed string matching.
 *
 * @param testQuery The query string from the test configuration.
 * @param inputQuery The query string from the incoming request.
 * @param opName The operation name to be used for extraction (from the test configuration).
 * @returns True if the documents are considered a match, false otherwise.
 */
function compareGraphQLDocuments(testQuery: string, inputQuery: string, opName?: string): boolean {
  try {
    const testAST = parse(testQuery);
    const inputAST = parse(inputQuery || "");
    const testOp = extractOperation(testAST, opName);
    const inputOp = extractOperation(inputAST, opName);
    if (!testOp || !inputOp) return false;
    const testOpStr = print(testOp);
    const inputOpStr = print(inputOp);
    return inputOpStr === testOpStr;
  } catch (e) {
    const testQueryText = testQuery.trim();
    const inputQueryText = inputQuery ? inputQuery.trim() : "";
    return inputQueryText.includes(testQueryText);
  }
}

/**
 * Represents a test client for a GraphQL API.
 *
 * @implements {IGraphQLClient}
 * @implements {IGraphQLTestConfig}
 */
export default class GraphQLTestClient implements IGraphQLClient, IGraphQLTestConfig {
  /**
   * When set to true, the matching algorithm will consider a test query a match
   * if its (trimmed) query string is found anywhere in the incoming request's
   * (trimmed) query string. Otherwise, it will require an exact match.
   */
  public MatchAnyPart: boolean = false;

  private TestQueriesArray: Array<ITestDynamicQuery<any, any>> = [];

  public addTestQuery = <TResult, TVariables = undefined>(
    arg:
      | (ITestQuery<TResult, TVariables> & { query?: string })
      | (Omit<ITestQuery<TResult, TVariables>, "query"> & { query?: TypedDocumentString<TResult, TVariables> })
      | ITestDynamicQuery<TResult, TVariables>,
  ) => {
    if (isFunction(arg)) {
      const arg2 = arg as ITestDynamicQuery<TResult, TVariables>;
      this.TestQueriesArray.push(arg2);
    } else {
      const arg2 = arg as ITestQuery<TResult, TVariables>;
      this.TestQueriesArray.push((input) => {
        // --- Matching documentId ---
        // If a documentId is provided in the test query, require that the input
        // request has the same documentId.
        if (arg2.documentId != null) {
          if (input.documentId !== arg2.documentId) return null;
        } else if ((arg2.query as TypedDocumentString<TResult, TVariables>)?.__meta__?.hash) {
          // If the query is a TypedDocumentString with a hash, match against documentId
          if (input.documentId !== (arg2.query as TypedDocumentString<TResult, TVariables>).__meta__?.hash) return null;
        } else {
          // Otherwise, fall back to matching based on the query text.
          if (!arg2.query) return null;

          const testQueryText = arg2.query.toString();
          if (this.MatchAnyPart) {
            // Always use arg2.operationName (do not fall back to input.operationName)
            if (!compareGraphQLDocuments(testQueryText, input.query || "", arg2.operationName)) {
              return null;
            }
          } else {
            const trimmedTestQuery = testQueryText.trim();
            const inputQueryText = input.query ? input.query.trim() : "";
            if (trimmedTestQuery !== inputQueryText) return null;
          }
        }

        // --- Matching other properties ---
        if ((arg2.operationName || null) !== (input.operationName || null)) return null;
        if (JSON.stringify(arg2.variables || null) !== JSON.stringify(input.variables || null)) return null;
        if (JSON.stringify(arg2.extensions || null) !== JSON.stringify(input.extensions || null)) return null;
        return arg2.result;
      });
    }
  };

  public getPendingRequests = () => 0;

  public getActiveSubscriptions = () => 0;

  public executeQueryRaw = <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>) => {
    const result = this.executeTestQuery<TReturn, TVariables>(request);
    if (!result) {
      throw new Error(
        'No test configured for the requested query - "' + request.query + '" - ' + JSON.stringify(request.variables || null),
      );
    }
    return {
      result: Promise.resolve(this.createQueryResult(result)),
      abort: () => {},
    };
  };

  private createQueryResult = <T>(result: ITestQueryResult<T>) => {
    let ret: IQueryResult<T>;
    if (result) {
      ret = {
        networkError: false,
        size: 0,
        ...result,
      };
    } else {
      ret = {
        networkError: true,
        size: 0,
        errors: [
          {
            message: "No test configured for the requested query",
          },
        ],
      };
    }
    return ret;
  };

  public executeQuery = <TReturn, TVariables = undefined>(
    request: IGraphQLRequest<TVariables>,
    cacheMode?: "no-cache" | "cache-first" | "cache-and-network",
  ) => {
    const queryResult = this.executeTestQuery<TReturn, TVariables>(request);
    if (!queryResult) {
      throw new Error(
        'No test configured for the requested query - "' + request.query + '" - ' + JSON.stringify(request.variables || null),
      );
    }
    const result = this.createQueryResult(queryResult);
    const resultPromise = Promise.resolve(result);
    const ret: IQueryResponse<TReturn> = {
      result: result,
      forceRefresh: () => {},
      clearAndRefresh: () => {},
      loading: false,
      refresh: () => resultPromise,
      resultPromise: resultPromise,
      subscribe: () => () => {},
    };
    return ret;
  };

  public executeTestQuery: <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>) => ITestQueryResult<TReturn> | null = (
    request: IGraphQLRequest<any>,
  ) => {
    for (let i = this.TestQueriesArray.length - 1; i >= 0; i--) {
      const ret = this.TestQueriesArray[i](request);
      if (ret) return ret;
    }
    return null;
  };

  public refreshAll = () => {};

  public clearCache = () => {};

  public resetStore = () => {};

  public executeSubscription = () => {
    throw new Error("Subscriptions not supported in test environment");
  };
}
