import * as React from 'react';
import { IGraphQLClient } from './GraphQLClient';

const GraphQLContext = React.createContext<IGraphQLClient>(null as any);

export default GraphQLContext;
