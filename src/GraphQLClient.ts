import axiosStatic, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface IGraphQLConfiguration {
    url: string,
    defaultFetchPolicy?: "cache-first" | "no-cache" | "cache-and-network",
    defaultCacheTime?: number,
    maxCacheSize?: number,
    transformRequest?: (request: AxiosRequestConfig) => Promise<AxiosRequestConfig>,
}

interface ICacheEntry {
    queryAndVariablesString: string,
    response: IQueryResponse<any>,
    size: number,
    expires: number,
    lastUsed: number,
    subscribers: Array<(result: IQueryResult<any> | null) => void>,
    cancelRequest?: () => void,
}

export interface IQueryOptions<TVariables> {
    variables?: TVariables | null,
    cacheMode?: "no-cache" | "cache-first" | "cache-and-network",
    expires?: number,
}

export interface IQueryResponse<T> {
    resultPromise: Promise<IQueryResult<T>>, //executes either now or when the pending query (if any) has completed
    loading: boolean,
    result: IQueryResult<T> | null,
    subscribe: (callback: (result: IQueryResult<T> | null) => void) => (() => void), //returns a callback to release the subscription
    refresh: () => Promise<IQueryResult<T>>,
    forceRefresh: () => void,
    clearAndRefresh: () => void,
}

export interface IQueryResult<T> {
    data?: T | null,
    errors?: Array<IGraphQLError>,
    extensions?: any,
    networkError: boolean,
    size: number,
}

export interface IGraphQLError {
    message: string,
    locations?: Array<{ line: number, column: number }>,
    path?: Array<string | number>,
    extensions?: {
        code?: string,
        codes?: string[],
        [key: string]: any,
    }
}

export interface IGraphQLClient {
    GetPendingRequests: () => number;
    ExecuteQueryRaw: <T>(query: string, variables?: any) => { result: Promise<IQueryResult<T>>, abort: () => void };
    ExecuteQuery: <TReturn, TVariables>(query: string, variables?: TVariables | null, cacheMode?: "no-cache" | "cache-first" | "cache-and-network") => IQueryResponse<TReturn>;
    RefreshAll: (force?: boolean) => void;
    ClearCache: () => void;
    ResetStore: () => void;
}

export default class GraphQLClient implements IGraphQLClient {
    private url: string;
    private axios: AxiosInstance;
    private cache: Map<string, ICacheEntry>;
    private cacheSize: number;
    private maxCacheSize: number;
    private transformRequest?: (request: AxiosRequestConfig) => Promise<AxiosRequestConfig>;
    private defaultCachePolicy: "no-cache" | "cache-first" | "cache-and-network";
    private defaultCacheTime: number;
    private pendingRequests: number;

    public constructor(configuration: IGraphQLConfiguration) {
        this.url = configuration.url;
        this.transformRequest = configuration.transformRequest;
        this.defaultCachePolicy = configuration.defaultFetchPolicy || "cache-first";
        this.defaultCacheTime = configuration.defaultCacheTime !== undefined ? configuration.defaultCacheTime : (24 /* hours */ * 60 /* minutes */ * 60 /* seconds */ * 1000 /* milliseconds */);
        this.cache = new Map<string, ICacheEntry>();
        this.cacheSize = 0;
        this.maxCacheSize = configuration.maxCacheSize || (1024 * 1024 * 20); //20MB
        this.axios = axiosStatic.create();
        this.pendingRequests = 0;
    }

    public GetPendingRequests = () => this.pendingRequests;

    public ExecuteQueryRaw: <T>(query: string, variables?: any) => { result: Promise<IQueryResult<T>>, abort: () => void } = <T>(query: string, variables?: any) => {
        var formData = new FormData();
        formData.append("query", query);
        formData.append("variables", JSON.stringify(variables || { }));
        const cancelSource = axiosStatic.CancelToken.source();
        const config: AxiosRequestConfig = {
            method: 'post',
            url: this.url,
            data: formData,
            responseType: 'text',
            transformResponse: [data => data],
            cancelToken: cancelSource.token,
        };
        this.pendingRequests += 1;
        const configPromise = this.transformRequest ? this.transformRequest(config) : Promise.resolve(config);
        const ret = configPromise.then(
            config2 => {
                return this.axios(config2).then(
                    (data: AxiosResponse<string>) => {
                        const queryRet = JSON.parse(data.data) as IQueryResult<T>;
                        if (queryRet.errors && queryRet.errors.length)
                            queryRet.data = undefined;
                        queryRet.networkError = false;
                        queryRet.size = data.data.length;
                        this.pendingRequests -= 1;
                        return Promise.resolve(queryRet);
                    },
                    (e: AxiosError) => {
                        const queryRet: IQueryResult<T> = {
                            networkError: true,
                            errors: [{ message: e?.message }],
                            extensions: {
                                underlyingError: e,
                            },
                            size: 1000,
                        };
                        this.pendingRequests -= 1;
                        return Promise.resolve(queryRet);
                    });
            },
            error => {
                const queryRet: IQueryResult<T> = {
                    networkError: true,
                    errors: [{ message: (typeof(error) === "string") ? error : 'Error initializing request configuration' }],
                    extensions: {
                        underlyingError: error,
                    },
                    size: 1000,
                };
                this.pendingRequests -= 1;
                return Promise.resolve(queryRet);
            });
        return {
            result: ret,
            abort: cancelSource.cancel,
        };
    }

    public ExecuteQuery = <TReturn, TVariables>(query: string, variables?: TVariables | null, cacheMode?: "no-cache" | "cache-first" | "cache-and-network") => {
        cacheMode = cacheMode || this.defaultCachePolicy;
        const queryAndVariablesString = JSON.stringify({ q: query, v: variables });
        const newEntryFactory = (newEntry: ICacheEntry) => {
            newEntry.response = {
                result: null,
                resultPromise: null as any,
                loading: false,
                refresh: () => {
                    if (newEntry.response.loading) return newEntry.response.resultPromise;
                    newEntry.response.loading = true;
                    const exec = this.ExecuteQueryRaw(query, variables);
                    newEntry.response.resultPromise = exec.result;
                    newEntry.cancelRequest = exec.abort;
                    exec.result.then(data => {
                        if (data.errors?.length) console.log('got error from ExecuteQueryRaw', { query: query, variables: variables, data: data });
                        // ensure that the data has not been force refreshed
                        if (newEntry.response.resultPromise === exec.result) {
                            // set the result and notify subscribers
                            newEntry.response.result = data;
                            newEntry.response.loading = false;
                            newEntry.cancelRequest = undefined;
                            if (data.errors && data.errors.length) {
                                newEntry.expires = 0;
                            } else {
                                this.SetCacheEntrySize(newEntry, data.size + 1000);
                                if (cacheMode !== "no-cache")
                                    newEntry.expires = Date.now() + this.defaultCacheTime;
                            }
                            newEntry.subscribers.forEach(subscriber => {
                                subscriber(data);
                            });
                        }
                    });
                    return exec.result;
                },
                forceRefresh: () => {
                    if (newEntry.response.loading) {
                        if (newEntry.cancelRequest) {
                            console.log('forceRefresh canceling request', newEntry);
                            newEntry.cancelRequest();
                        }
                        newEntry.cancelRequest = undefined;
                        newEntry.response.loading = false;
                        newEntry.response.resultPromise = null as any;
                    }
                    newEntry.response.refresh();
                },
                clearAndRefresh: () => {
                    if (newEntry.response.loading) {
                        if (newEntry.cancelRequest) {
                            console.log('clearAndRefresh canceling request', newEntry);
                            newEntry.cancelRequest();
                        }
                        newEntry.cancelRequest = undefined;
                        newEntry.response.loading = false;
                        newEntry.response.resultPromise = null as any;
                    }
                    newEntry.response.refresh();
                    if (newEntry.response.loading) {
                        newEntry.response.result = null;
                        newEntry.subscribers.forEach(subscriber => {
                            subscriber(null);
                        });
                    }
                },
                subscribe: callback => {
                    newEntry.subscribers.push(callback);
                    return () => {
                        newEntry.subscribers = newEntry.subscribers.filter(x => x !== callback);
                    };
                }
            };
            newEntry.response.refresh();
        };
        const newEntry = this.GetOrCreateCacheEntry(queryAndVariablesString, newEntryFactory, cacheMode === "no-cache");
        if (newEntry.subscribers.length === 0 && (cacheMode === "cache-and-network" || newEntry.expires < Date.now())) {
            newEntry.response.refresh();
        }
        return newEntry.response as IQueryResponse<TReturn>;
    }

    public RefreshAll = (force?: boolean) => {
        // expire all cache entries
        // dump cache entries not in use
        // refresh cache entries in use
        this.ClearCache();
        this.cache.forEach(value => {
            if (value.subscribers.length > 0) {
                if (force) value.response.forceRefresh(); else value.response.refresh();
            }
        });
    }

    public ClearCache = () => {
        // expire all cache entries
        // dump cache entries not in use
        // do not refresh cache entries in use
        this.cache.forEach(value => {
            value.expires = 0;
        });
        this.AllocateCacheSize(this.maxCacheSize);
    }

    public ResetStore = () => {
        // expire all cache entries not in use
        // dump cache entries not in use
        this.ClearCache();
        // refresh all cache entries in use
        this.cache.forEach(value => {
            value.response.clearAndRefresh();
        });
    }

    private GetOrCreateCacheEntry = (queryAndVariablesString: string, newEntryFactory: (cacheEntry: ICacheEntry) => void, noCache: boolean) => {
        // this always adds the new entry even if the lifetime is zero
        const valueFromCache = this.cache.get(queryAndVariablesString);
        const nowDate = Date.now();
        if (valueFromCache) {
            if (valueFromCache.subscribers.length > 0 || !noCache) {
                valueFromCache.lastUsed = Date.now();
                return valueFromCache;
            } else {
                if (this.cache.delete(queryAndVariablesString))
                    this.cacheSize -= valueFromCache.size;
            }
        }
        const newEntry: ICacheEntry = {
            queryAndVariablesString: queryAndVariablesString,
            expires: 0,
            lastUsed: nowDate,
            response: null as any,
            subscribers: [],
            size: 1000,
        };
        newEntryFactory(newEntry);
        this.AllocateCacheSize(newEntry.size);
        newEntry.queryAndVariablesString = queryAndVariablesString;
        newEntry.lastUsed = nowDate;
        this.cacheSize += newEntry.size;
        this.cache.set(queryAndVariablesString, newEntry);
        return newEntry;
    }

    private SetCacheEntrySize = (cacheEntry: ICacheEntry, newSize: number) => {
        const entry = this.cache.get(cacheEntry.queryAndVariablesString);
        if (entry && entry === cacheEntry) {
            this.cacheSize -= entry.size;
            this.AllocateCacheSize(newSize, entry);
            this.cacheSize += entry.size;
        }
        cacheEntry.size = newSize;
    }

    private AllocateCacheSize = (newSize: number, exclude?: ICacheEntry) => {
        //check if we need more space
        const needBytes = (this.cacheSize + newSize) - this.maxCacheSize;
        if (needBytes <= 0) {
            return;
        }
        //delete expired entries
        const nowDate = Date.now();
        const entriesToRemove: ICacheEntry[] = [];
        this.cache.forEach(value => { //(value, key)
            if (value.subscribers.length === 0 && value.expires < nowDate) {
                entriesToRemove.push(value);
            }
        });
        entriesToRemove.forEach(value => {
            if (this.cache.delete(value.queryAndVariablesString)) {
                this.cacheSize -= value.size;
            }
        });
        //deleted oldest entry
        do {
            const needBytes = (this.cacheSize + newSize) - this.maxCacheSize;
            if (needBytes <= 0) break;
            let oldestEntry: ICacheEntry | undefined | null;
            this.cache.forEach(value => { //(value, key)
                if (value.subscribers.length === 0 && value !== exclude) {
                    if (!oldestEntry || value.lastUsed < oldestEntry.lastUsed)
                        oldestEntry = value;
                }
            });
            if (oldestEntry) {
                if (this.cache.delete(oldestEntry.queryAndVariablesString)) {
                    this.cacheSize -= oldestEntry.size;
                }
                oldestEntry = null;
            } else {
                break;
            }
        } while (true)
    }
}
