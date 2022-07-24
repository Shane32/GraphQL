import * as React from 'react';
import { IGraphQLClient } from './GraphQLClient';

const GraphQLGuestContext = React.createContext<IGraphQLClient>(null as any);

export default GraphQLGuestContext;
