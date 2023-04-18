interface IGraphQLConfiguration {
    url: string,
    webSocketUrl?: string,
    defaultFetchPolicy?: "cache-first" | "no-cache" | "cache-and-network",
    defaultCacheTime?: number,
    maxCacheSize?: number,
    transformRequest?: (request: Request) => Request | PromiseLike<Request>,
    generatePayload?: () => {} | PromiseLike<{}>,
    asForm?: boolean,
}

export default IGraphQLConfiguration;
