import IGraphQLClient from "./IGraphQLClient";

interface IGraphQLContext {
    client: IGraphQLClient;
    guest?: IGraphQLClient;
    [key: string]: IGraphQLClient | undefined;
}

export default IGraphQLContext;
