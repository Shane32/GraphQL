interface IGraphQLRequestWithArguments<TVariables> {
    query: string;
    variables: TVariables;
    extensions?: {} | null;
    operationName?: string;
}

interface IGraphQLRequestNoArguments {
    query: string;
    variables?: null;
    extensions?: {} | null;
    operationName?: string;
}

type IGraphQLRequest<TVariables = undefined> = TVariables extends undefined ? IGraphQLRequestNoArguments : IGraphQLRequestWithArguments<TVariables>;

export default IGraphQLRequest;
