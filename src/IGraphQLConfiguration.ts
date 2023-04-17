interface IGraphQLConfiguration {
    url: string,
    webSocketUrl?: string,
    defaultFetchPolicy?: "cache-first" | "no-cache" | "cache-and-network",
    defaultCacheTime?: number,
    maxCacheSize?: number,
    transformRequest?: (request: Request) => Promise<Request>,
    generatePayload?: () => Promise<{}>,
}

export default IGraphQLConfiguration;
