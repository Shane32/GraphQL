import IGraphQLRequest from "./IGraphQLRequest";
import ITestQueryResult from "./ITestQueryResult";

type ITestDynamicQuery<TResult, TVariables = undefined> = (request: IGraphQLRequest<TVariables>) => ITestQueryResult<TResult> | null;

export default ITestDynamicQuery;
