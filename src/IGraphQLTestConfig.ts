import ITestDynamicQuery from "./ITestDynamicQuery";
import ITestQuery from "./ITestQuery";

interface IGraphQLTestConfig {
    AddTestQuery: <TResult, TVariables>(arg: ITestQuery<TResult, TVariables> | ITestDynamicQuery<TResult, TVariables>) => void;
}

export default IGraphQLTestConfig;
