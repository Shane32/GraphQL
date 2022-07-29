import IGraphQLError from "./IGraphQLError";

interface ITestQueryResult<TResult> {
    data?: TResult,
    errors?: IGraphQLError[],
};

export default ITestQueryResult;
