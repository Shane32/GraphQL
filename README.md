# GraphQL npm package

This provides access to GraphQL servers within a React 16/18 and Axios environment.  Supported features:

- Multiple clients/endpoints
- Caching for queries
- Subscription support with the [graphql-ws](https://github.com/enisdenjo/graphql-ws) protocol
- Test environment
- Typescript support

# Setup

Install the `@shane32/graphql` npm package:

```
npm install @shane32/graphql
```

# Configuration

1. Set up a client in your index.tsx page

```javascript
const client = new GraphQLClient({
    url: 'https://localhost/graphql',         // required; url of GraphQL endpoint
    webSocketUrl: 'wss://localhost/graphql',  // optional; url of GraphQL WebSocket endpoint
    defaultFetchPolicy: 'cache-first'         // optional; default is cache-first; other options are no-cache and cache-and-network
    defaultCacheTime: 24 * 60 * 60 * 1000     // optional; specified in milliseconds; default is 1 day
    maxCacheSize: 20 * 1024 * 1024            // optional; specified in bytes; default is 20MB

    // optional; transformation of AxiosRequestConfig; used to provide authentication information to request
    transformRequest: request => Promise.resolve(request)

    // optional; provides payload for WebSocket connection initialization messages; used to provide authentication information to request
    generatePayload: () => Promise.resolve({})
});
```

2. Set up context for hooks

```
const context: IGraphQLContext = {
    client: client                      // required: default client
    guest: guestClient                  // optional: guest client
    "alt": altClient                    // optional: any other clients
};
```

3. Provide context to application

```tsx
<GraphQLContext.Provider value={context}>
    ...
</GraphQLContext.Provider>
```

# Usage

It is simplest to set up your query and types first.

```typescript
const productQuery = 'query($id: ID!) { product(id: $id) { name price } }';

interface ProductQueryResult {
    product: { name: string, price: number } | null;
}

interface ProductQueryVariables {
    id: string
}
```

Then you can use the client directly, or use one of the hooks.

## Direct use - query/mutation

```typescript
// pull from context, if applicable
const client = React.useContext(GraphQLContext).client;

// execute the query
const result = await client.ExecuteQueryRaw<ProductQueryResult, ProductQueryVariables>({ query: productQuery, variables: { id: productId } }).result;
```

## useQuery hook

todo

## useMutation hook

todo

## Direct use - subscriptions

todo
