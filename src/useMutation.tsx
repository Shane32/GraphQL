import GraphQLClient from './GraphQLClient';
import GraphQLError from './GraphQLError';
import IQueryResult from './IQueryResult';
import useGraphQLClient from './useGraphQLClient';

type IUseMutation = <TResult, TVariables>(query: string, options?: {
    client?: GraphQLClient,
    variables?: TVariables,
}) => [(options?: { variables?: TVariables }) => Promise<IQueryResult<TResult>>];

const useMutation: IUseMutation = <TResult, TVariables>(query: string, options?: {
    guest?: boolean,
    client?: GraphQLClient | string,
    variables?: TVariables,
}) => {
    const client = useGraphQLClient(options && options.client, options && options.guest);
    var ret = (options2?: { variables?: TVariables }) => {
        return client.ExecuteQueryRaw<TResult>(query, options2?.variables || options?.variables).result.then(
            (data) => {
                if (data.data && !(data.errors && data.errors.length))
                    return Promise.resolve(data);
                return Promise.reject(new GraphQLError(data));
            });
    }
    return [ret];
};

export default useMutation;
