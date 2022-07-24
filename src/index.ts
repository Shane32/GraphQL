import GraphQLClient, {
  IGraphQLConfiguration,
  IQueryOptions,
  IQueryResponse,
  IQueryResult,
  IGraphQLError,
  IGraphQLClient
} from './GraphQLClient';

import GraphQLContext from './GraphQLContext';
import GraphQLGuestContext from './GraphQLGuestContext';
import GraphQLError from './GraphQLError';
import useQuery from './useQuery';
import useMutation from './useMutation';
import gql from './graphql-tag';

import GraphQLTestClient, {
  ITestQueryResult,
  ITestQuery,
  ITestDynamicQuery,
  IGraphQLTestConfig
} from './GraphQLTestClient';

export {
  GraphQLClient,
  IGraphQLConfiguration,
  IQueryOptions,
  IQueryResponse,
  IQueryResult,
  IGraphQLError,
  IGraphQLClient,

  GraphQLContext,
  GraphQLGuestContext,
  GraphQLError,
  useQuery,
  useMutation,
  gql,

  GraphQLTestClient,
  ITestQueryResult,
  ITestQuery,
  ITestDynamicQuery,
  IGraphQLTestConfig
}
