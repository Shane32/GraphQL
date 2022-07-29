import IGraphQLRequest from "./IGraphQLRequest";
import ITestQueryResult from "./ITestQueryResult";

type ITestQuery<TResult, TVariables = undefined> = IGraphQLRequest<TVariables> & {
    result: ITestQueryResult<TResult>
};

export default ITestQuery;
