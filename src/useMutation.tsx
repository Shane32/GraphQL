import GraphQLClient, { IQueryResult } from './GraphQLClient';
import { useContext } from 'react';
import GraphQLContext from './GraphQLContext';
import GraphQLError from './GraphQLError';

type IUseMutation = <TResult, TVariables>(query: string, options?: {
    client?: GraphQLClient,
    variables?: TVariables,
}) => [(options?: { variables?: TVariables }) => Promise<IQueryResult<TResult>>];

const useMutation: IUseMutation = <TResult, TVariables>(query: string, options?: {
    client?: GraphQLClient,
    variables?: TVariables,
}) => {
    const clientContext = useContext(GraphQLContext);
    const client = options?.client || clientContext;
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
