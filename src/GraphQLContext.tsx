import * as React from 'react';
import IGraphQLContext from './IGraphQLContext';

const GraphQLContext = React.createContext<IGraphQLContext>(null as any);

export default GraphQLContext;
