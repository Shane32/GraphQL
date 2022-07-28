import { AxiosRequestConfig } from 'axios';

interface IGraphQLConfiguration {
    url: string,
    webSocketUrl?: string,
    defaultFetchPolicy?: "cache-first" | "no-cache" | "cache-and-network",
    defaultCacheTime?: number,
    maxCacheSize?: number,
    transformRequest?: (request: AxiosRequestConfig) => Promise<AxiosRequestConfig>,
    generatePayload?: () => Promise<{}>,
}

export default IGraphQLConfiguration;
