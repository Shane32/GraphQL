import GraphQLClient from './GraphQLClient';
import GraphQLError from './GraphQLError';
import IQueryResult from './IQueryResult';
import useGraphQLClient from './useGraphQLClient';

/**
 * Represents the `useMutation` hook.
 */
type IUseMutation = <TResult, TVariables>(query: string, options?: {
    /** The client to use for the mutation, or the name of the client. */
    client?: GraphQLClient | string,
    /** The variables to use for the mutation. */
    variables?: TVariables,
    /** The name of the operation to use for the mutation. */
    operationName?: string,
    /** Additional extensions to add to the mutation. */
    extensions?: {} | null,
}) => [(options?: { variables?: TVariables }) => Promise<IQueryResult<TResult>>];

/**
 * Returns a function that executes a GraphQL mutation.
 * 
 * @template TResult The expected result type of the mutation.
 * @template TVariables The expected variables type of the mutation.
 * @param {string} query The GraphQL query string.
 * @param {object} [options] The options for the mutation.
 * @param {GraphQLClient} [options.client] The client to use for the mutation.
 * @param {TVariables} [options.variables] The variables to use for the mutation.
 * @param {string} [options.operationName] The name of the operation to use for the mutation.
 * @param {object} [options.extensions] Additional extensions to add to the mutation.
 * @returns {Array<Function>} A function that executes the mutation.
 */
const useMutation: IUseMutation = <TResult, TVariables>(query: string, options?: {
    guest?: boolean,
    client?: GraphQLClient | string,
    variables?: TVariables,
    operationName?: string,
    extensions?: {} | null,
}) => {
    const client = useGraphQLClient(options && options.client, options && options.guest);
    /**
     * Executes the mutation with the specified variables.
     * 
     * @param {object} [options2] The options for the mutation.
     * @param {TVariables} [options2.variables] The variables to use for the mutation.
     * @returns {Promise<IQueryResult<TResult>>} A promise that resolves to the result of the mutation.
     */
    var ret = (options2?: { variables?: TVariables }) => {
        return client.ExecuteQueryRaw<TResult>({
            query,
            variables: (options2?.variables || options?.variables) as any,
            operationName: options && options.operationName,
            extensions: options && options.extensions,
        }).result.then(
            (data) => {
                if (data.data && !(data.errors && data.errors.length))
                    return Promise.resolve(data);
                return Promise.reject(new GraphQLError(data));
            });
    }
    return [ret];
};

export default useMutation;
