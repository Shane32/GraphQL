# GraphQL npm package

This provides access to GraphQL servers within a React 16/18 environment.  Supported features:

- Multiple clients/endpoints
- Caching for queries
- Subscription support with the [graphql-ws](https://github.com/enisdenjo/graphql-ws) protocol
- Test environment
- Typescript support

# Requirements

This package uses the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) and will require
a polyfill for older browsers.  When running in a test environment, you will need to provide a mock implementation
of the Fetch API.

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
    isForm: true,                             // optional; whether to use form data for POST requests instead of JSON

    defaultFetchPolicy: 'cache-first'         // optional; default is cache-first; other options are no-cache and cache-and-network
    defaultCacheTime: 24 * 60 * 60 * 1000     // optional; specified in milliseconds; default is 1 day
    maxCacheSize: 20 * 1024 * 1024            // optional; specified in bytes; default is 20MB

    // optional; transformation of Request; used to provide authentication information to request
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

const updateProductPriceMutation = 'mutation($id: ID!, $price: Float!) { updateProductPrice(id: $id, price: $price) { name price } }';

interface ProductPriceMutationResult {
    updateProductPrice: { name: string, price: number } | null;
}

interface ProductPriceMutationVariables {
    id: string;
    price: number;
}

const priceUpdateSubscription = 'subscription($id: ID!) { priceUpdate(id: $id) { price } }';

interface ProductPriceSubscriptionResult {
    priceUpdate: { price: number };
}

interface ProductPriceSubscriptionVariables {
    id: string;
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

```tsx
const ProductComponent = ({ productId }) => {
    const { error, data, refetch } = useQuery<ProductQueryResult, ProductQueryVariables>(productQuery, { variables: { id: productId } });
  
    // display message if failed to retrieve data, with button to retry
    if (error) return <ErrorDisplay onClick={refetch}>{error.message}</ErrorDisplay>;

    // display loading if waiting for data to load
    if (!data) return <Loading />;

    return (
        <div>
            <h3>{data.product.name}</h3>
            <p>Price: ${data.product.price}</p>
        </div>
    );
};
```

## useMutation hook

```tsx
const UpdateProductPriceComponent = ({ productId }) => {
    const [updateProductPrice] = useMutation<ProductPriceMutationResult, ProductPriceMutationVariables>(updateProductPriceMutation);

    const handleSubmit = async (newPrice) => {
        try {
            const ret = await updateProductPrice({ variables: { id: productId, price: newPrice } });
            alert('Saved!');
        } catch {
            alert('Failure');
        }
    };
  
    return (
        <div>
            <button onClick={() => handleSubmit(50)}>Update Price to $50</button>
        </div>
    );
};
```

## Direct use - subscriptions

```typescript
const ProductPriceUpdateComponent = ({ productId }) => {
    const client = React.useContext(GraphQLContext).client;

    useEffect(() => {
        const { connected, abort } = client.ExecuteSubscription<ProductPriceSubscriptionResult, ProductPriceSubscriptionVariables>(
            { query: priceUpdateSubscription, variables: { id: productId } },
            (data) => {
                if (data.data) {
                    console.log("New price:", data.data.priceUpdate.price);
                } else {
                    console.error("Error:", data.errors);
                }
            },
            () => {
                console.log("Subscription closed");
            }
        );

        return () => {
            abort();
        };
    }, [client, productId, priceUpdateSubscription]);

    return (
      <div>
        <p>Listening for price updates...</p>
      </div>
    );
};
```
