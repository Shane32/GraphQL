import IGraphQLClient from './IGraphQLClient';
import IGraphQLConfiguration from './IGraphQLConfiguration';
import IGraphQLRequest from './IGraphQLRequest';
import IQueryResponse from './IQueryResponse';
import IQueryResult from './IQueryResult';

interface ICacheEntry {
    queryAndVariablesString: string,
    response: IQueryResponse<any>,
    size: number,
    expires: number,
    lastUsed: number,
    subscribers: Array<(result: IQueryResult<any> | null) => void>,
    cancelRequest?: () => void,
}

export default class GraphQLClient implements IGraphQLClient {
    private url: string;
    private webSocketUrl: string;
    private cache: Map<string, ICacheEntry>;
    private cacheSize: number;
    private maxCacheSize: number;
    private transformRequest?: (request: Request) => Promise<Request>;
    private generatePayload?: () => Promise<{}>;
    private defaultCachePolicy: "no-cache" | "cache-first" | "cache-and-network";
    private defaultCacheTime: number;
    private pendingRequests: number;
    private activeSubscriptions: number;

    public constructor(configuration: IGraphQLConfiguration) {
        this.url = configuration.url;
        this.webSocketUrl = configuration.webSocketUrl || configuration.url;
        this.transformRequest = configuration.transformRequest;
        this.defaultCachePolicy = configuration.defaultFetchPolicy || "cache-first";
        this.defaultCacheTime = configuration.defaultCacheTime !== undefined ? configuration.defaultCacheTime : (24 /* hours */ * 60 /* minutes */ * 60 /* seconds */ * 1000 /* milliseconds */);
        this.generatePayload = configuration.generatePayload;
        this.cache = new Map<string, ICacheEntry>();
        this.cacheSize = 0;
        this.maxCacheSize = configuration.maxCacheSize || (1024 * 1024 * 20); //20MB
        this.pendingRequests = 0;
        this.activeSubscriptions = 0;
    }

    public GetPendingRequests = () => this.pendingRequests;

    public GetActiveSubscriptions = () => this.activeSubscriptions;

    public ExecuteQueryRaw = <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>) => {
        var formData = new FormData();
        formData.append("query", request.query);
        if (request.variables)
            formData.append("variables", JSON.stringify(request.variables));
        if (request.operationName)
            formData.append("operationName", request.operationName);
        if (request.extensions)
            formData.append("extensions", JSON.stringify(request.extensions));

        const cancelSource = typeof AbortController === "undefined" ? undefined : new AbortController();
        const config = new Request(this.url, {
            method: "POST",
            body: formData,
            signal: cancelSource ? cancelSource.signal : undefined,
        });

        this.pendingRequests += 1;
        const configPromise = this.transformRequest ? this.transformRequest(config) : Promise.resolve(config);
        const ret = configPromise.then(
            config2 => {
                return fetch(config2).then(
                    (data: Response) => {
                        this.pendingRequests -= 1;
                        const valid = (data.status >= 200 && data.status < 300) ||
                            (data.status >= 400 && data.status < 500);
                        if (!valid) {
                            const queryRet: IQueryResult<TReturn> = {
                                networkError: true,
                                errors: [{ message: data.statusText }],
                                size: 1000,
                            };
                            return Promise.resolve(queryRet);
                        }
                        return data.json().then(jsonData => {
                            const queryRet = jsonData as IQueryResult<TReturn>;
                            if (queryRet.errors && queryRet.errors.length)
                                queryRet.data = undefined;
                            queryRet.networkError = false;
                            queryRet.size = JSON.stringify(jsonData).length;
                            return Promise.resolve(queryRet);
                        });
                    })
                    .catch(error => {
                        // if undefined error occurs, rethrow
                        const queryRet: IQueryResult<TReturn> = {
                            networkError: true,
                            errors: [{ message:  (typeof (error) === "string") ? error : (error.message || 'Unknown error') }],
                            extensions: {
                                underlyingError: error,
                            },
                            size: 1000,
                        };
                        return Promise.resolve(queryRet);
                    });
            },
            error => {
                this.pendingRequests -= 1;
                const queryRet: IQueryResult<TReturn> = {
                    networkError: true,
                    errors: [{ message: (typeof(error) === "string") ? error : 'Error initializing request configuration' }],
                    extensions: {
                        underlyingError: error,
                    },
                    size: 1000,
                };
                return Promise.resolve(queryRet);
            });
        return {
            result: ret,
            abort: cancelSource?.abort || (() => { }),
        };
    }

    public ExecuteQuery = <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>, cacheMode?: "no-cache" | "cache-first" | "cache-and-network") => {
        cacheMode = cacheMode || this.defaultCachePolicy;
        const queryAndVariablesString = JSON.stringify(request);
        const newEntryFactory = (newEntry: ICacheEntry) => {
            newEntry.response = {
                result: null,
                resultPromise: null as any,
                loading: false,
                refresh: () => {
                    if (newEntry.response.loading) return newEntry.response.resultPromise;
                    newEntry.response.loading = true;
                    const exec = this.ExecuteQueryRaw<TReturn, TVariables>(request);
                    newEntry.response.resultPromise = exec.result;
                    newEntry.cancelRequest = exec.abort;
                    exec.result.then(data => {
                        if (data.errors?.length) console.log('got error from ExecuteQueryRaw', { request, data });
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

    public ExecuteSubscription = <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>, onData: (data: IQueryResult<TReturn>) => void, onClose: () => void) => {
        this.activeSubscriptions += 1;
        const subscriptionId = "1";
        // set up abort
        let aborted = false;
        let doAbort: () => void = null!;
        const abortPromise = new Promise<void>(doAbort2 => {
            doAbort = doAbort2;
        });
        // abort will set aborted and call onClose
        abortPromise.then(() => {
            this.activeSubscriptions -= 1;
            aborted = true;
            onClose();
        });
        // set up data push
        const doData = (data: IQueryResult<TReturn>) => {
            if (!aborted)
                onData(data);
        };
        // set up error close
        const doError = (error: any) => {
            if (aborted)
                return;
            const queryRet: IQueryResult<TReturn> = {
                networkError: true,
                errors: [{ message: (typeof (error) === "string") ? error : 'Error generating websocket connection payload' }],
                extensions: {
                    underlyingError: error,
                },
                size: 1000,
            };
            onData(queryRet);
            doAbort();
        }

        // set up connection promise
        const connectionPromise = new Promise<void>(
            (resolveConnection, rejectConnection) => {
                let connectionResolved = false;
                abortPromise.then(() => {
                    if (!connectionResolved) {
                        connectionResolved = true;
                        rejectConnection();
                    }
                })
                // attempt to generate the connection payload
                const payloadPromise = this.generatePayload ? this.generatePayload() : Promise.resolve(undefined);
                payloadPromise.then(
                    payload => {
                        if (aborted)
                            return;
                        // connect to the websocket endpoint
                        const webSocket = new WebSocket(this.webSocketUrl, "graphql-transport-ws");
                        // set up abort/close
                        abortPromise.then(() => {
                            webSocket.close();
                        });
                        // set up state machine
                        let state: "opening" | "connected" = "opening";
                        // when connection is opened, send connection init message
                        webSocket.onopen = () => {
                            if (aborted)
                                return;
                            const message = {
                                type: 'connection_init',
                                payload: payload,
                            };
                            webSocket.send(JSON.stringify(message));
                        };
                        // when message received, process it
                        webSocket.onmessage = (ev) => {
                            // parse the incoming message
                            if (aborted)
                                return;
                            if (typeof ev.data !== "string")
                                doError("WebSocket data is not string");
                            let message: any;
                            try {
                                message = JSON.parse(ev.data);
                            } catch {
                                doError("WebSocket message is not valid JSON");
                            }
                            if (message === null)
                                doError("WebSocket message is null");

                            // process message based on state machine
                            if (message.type === "ping") {
                                webSocket.send(JSON.stringify({ type: "pong" }));
                            } else if (state === "opening") {
                                if (message.type !== "connection_ack")
                                    doError("Invalid connection response from WebSocket server");
                                else {
                                    state = "connected";
                                    if (!connectionResolved) {
                                        connectionResolved = true;
                                        resolveConnection();
                                    }
                                    webSocket.send(JSON.stringify({
                                        id: subscriptionId,
                                        type: "subscribe",
                                        payload: request,
                                    }));
                                }
                            } else if (state === "connected") {
                                if (message.type === "next") {
                                    if (!message.payload || (!message.payload.data && !message.payload.errors) || message.id !== subscriptionId) {
                                        doError("Invalid payload for 'next' packet");
                                    } else {
                                        doData({
                                            networkError: false,
                                            size: (ev.data as string).length,
                                            data: message.payload.data,
                                            errors: message.payload.errors,
                                            extensions: message.payload.extensions,
                                        });
                                    }
                                } else if (message.type === "error") {
                                    if (!message.payload || message.id !== subscriptionId)
                                        doError("Invalid payload for 'error' packet");
                                    doData({
                                        networkError: false,
                                        size: (ev.data as string).length,
                                        errors: message.payload,
                                    });
                                    doAbort();
                                } else if (message.type === "complete") {
                                    if (message.id !== subscriptionId)
                                        doError("Invalid payload for 'complete' packet");
                                    doAbort();
                                }
                            }
                        };
                        // when websocket closed, notify caller (only raises error if not closed from this end)
                        webSocket.onclose = () => {
                            doError("WebSocket connection unexpectedly closed");
                        };
                    },
                    // when failed to generate payload, notify caller
                    error => {
                        doError(error);
                    });
            });

        return {
            connected: connectionPromise,
            abort: doAbort,
        };
    };

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
