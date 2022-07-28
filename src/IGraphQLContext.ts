import GraphQLClient, { IGraphQLClient } from "./GraphQLClient";

interface IGraphQLContext {
    client: IGraphQLClient;
    guest?: IGraphQLClient;
    [key: string]: IGraphQLClient | undefined;
}

export default IGraphQLContext;