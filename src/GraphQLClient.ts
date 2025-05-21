import IGraphQLClient from "./IGraphQLClient";
import IGraphQLConfiguration from "./IGraphQLConfiguration";
import IGraphQLRequest from "./IGraphQLRequest";
import IQueryResponse from "./IQueryResponse";
import IQueryResult from "./IQueryResult";
import IRequest from "./IRequest";
import IWebSocketMessage from "./IWebSocketMessage";

interface ICacheEntry {
  queryAndVariablesString: string;
  response: IQueryResponse<any>;
  size: number;
  expires: number;
  lastUsed: number;
  subscribers: Array<(result: IQueryResult<any> | null) => void>;
  cancelRequest?: () => void;
}

/**
 * Represents a client for making GraphQL requests.
 */
export default class GraphQLClient implements IGraphQLClient {
  private url: string;
  private webSocketUrl: string;
  private cache: Map<string, ICacheEntry>;
  private cacheSize: number;
  private maxCacheSize: number;
  private transformRequest?: (request: IRequest) => IRequest | PromiseLike<IRequest>;
  private generatePayload?: () => {} | PromiseLike<{}>;
  private defaultCachePolicy: "no-cache" | "cache-first" | "cache-and-network";
  private defaultCacheTime: number;
  private pendingRequests: number;
  private activeSubscriptions: number;
  private asForm?: boolean;
  private sendDocumentIdAsQuery?: boolean;
  private logHttpError?: (request: IRequest, response: Response) => void;
  private logWebSocketConnectionError?: (request: IGraphQLRequest<any>, connectionMessage: any, receivedMessage: any) => void;

  public constructor(configuration: IGraphQLConfiguration) {
    this.url = configuration.url;
    this.webSocketUrl = configuration.webSocketUrl || configuration.url;
    this.transformRequest = configuration.transformRequest;
    this.defaultCachePolicy = configuration.defaultFetchPolicy || "cache-first";
    this.defaultCacheTime =
      configuration.defaultCacheTime !== undefined
        ? configuration.defaultCacheTime
        : 24 /* hours */ * 60 /* minutes */ * 60 /* seconds */ * 1000; /* milliseconds */
    this.generatePayload = configuration.generatePayload;
    this.cache = new Map<string, ICacheEntry>();
    this.cacheSize = 0;
    this.maxCacheSize = configuration.maxCacheSize || 1024 * 1024 * 20; //20MB
    this.pendingRequests = 0;
    this.activeSubscriptions = 0;
    this.asForm = configuration.asForm;
    this.sendDocumentIdAsQuery = configuration.sendDocumentIdAsQuery;
    this.logHttpError = configuration.logHttpError;
    this.logWebSocketConnectionError = configuration.logWebSocketConnectionError;
  }

  public GetPendingRequests = () => this.pendingRequests;

  public GetActiveSubscriptions = () => this.activeSubscriptions;

  public ExecuteQueryRaw = <TReturn, TVariables = undefined>(request: IGraphQLRequest<TVariables>) => {
    let body: FormData | string;

    // If the request should be sent as a form, create a FormData object and append the necessary fields
    if (this.asForm) {
      const formData = new FormData();
      if (request.query) formData.append("query", request.query);
      if (request.documentId && !this.sendDocumentIdAsQuery) formData.append("documentId", request.documentId);
      if (request.variables) formData.append("variables", JSON.stringify(request.variables));
      if (request.operationName) formData.append("operationName", request.operationName);
      if (request.extensions) formData.append("extensions", JSON.stringify(request.extensions));
      body = formData;
    } else {
      // Otherwise, send the request as a JSON string
      if (request.documentId && this.sendDocumentIdAsQuery) {
        const { documentId, ...partialRequest } = request;
        body = JSON.stringify(partialRequest);
      } else {
        body = JSON.stringify(request);
      }
    }

    // define the url
    let url = this.url;
    if (request.documentId && this.sendDocumentIdAsQuery) {
      url += (url.indexOf("?") >= 0 ? "&" : "?") + "documentId=" + encodeURIComponent(request.documentId);
    }

    // Create a cancel source using the AbortController API, if it is available
    const cancelSource = typeof AbortController === "undefined" ? undefined : new AbortController();

    // Create a new IRequest object with the URL, method, body, headers, and cancel signal
    const config: IRequest = {
      url: url,
      method: "POST",
      body: body,
      headers: this.asForm ? undefined : { "Content-Type": "application/json" },
      signal: cancelSource ? cancelSource.signal : null,
    };

    // Increment the number of pending requests
    this.pendingRequests += 1;

    // Send the request using fetch, and return a promise that resolves to the response
    const ret = Promise.resolve(config)
      .then((config2) => {
        // If a transformRequest function is defined, apply it to the request configuration
        return this.transformRequest ? this.transformRequest(config2) : config2;
      })
      .then((config2) => {
        // Create the Request object
        const config3 = { ...config2 } as any;
        const url = config3.url;
        delete config3.url;
        return new Request(url, config3);
      })
      .then(
        (request) => {
          // Start the Fetch operation
          return fetch(request)
            .then(
              (data: Response) => {
                // Decrement the number of pending requests
                this.pendingRequests -= 1;

                // Log non-2xx status codes if the callback is defined
                if (this.logHttpError && (data.status < 200 || data.status >= 300)) {
                  // Clone the response to avoid consuming it
                  this.logHttpError(request, data.clone());
                }

                // Check if the response status is valid (between 200 and 299 or between 400 and 499)
                const valid = (data.status >= 200 && data.status < 300) || (data.status >= 400 && data.status < 500);

                // If the response status is not valid, create a new query result object with the error message
                if (!valid) {
                  const queryRet: IQueryResult<TReturn> = {
                    networkError: true,
                    errors: [{ message: data.statusText }],
                    size: 1000,
                  };
                  return Promise.resolve(queryRet);
                }

                // Parse the JSON data and create a new query result object with the data and any errors
                return data.json().then((jsonData) => {
                  const queryRet = jsonData as IQueryResult<TReturn>;
                  if (queryRet.errors && queryRet.errors.length) queryRet.data = undefined;
                  queryRet.networkError = false;

                  // Calculate the size of the response and set it on the query result object
                  const contentLengthHeader = data.headers.get("Content-Length");
                  if (contentLengthHeader) {
                    queryRet.size = parseInt(contentLengthHeader, 10);
                  } else {
                    queryRet.size = JSON.stringify(jsonData).length;
                  }

                  return Promise.resolve(queryRet);
                });
              },
              (error) => {
                // Decrement the number of pending requests
                this.pendingRequests -= 1;
                // Rethrow the error
                return Promise.reject(error);
              },
            )
            .catch((error) => {
              // If an unhandled error occurs, create a new query result object with the error message and the underlying error
              const queryRet: IQueryResult<TReturn> = {
                networkError: true,
                errors: [
                  {
                    message: typeof error === "string" ? error : error.message || "Unknown error from Fetch API",
                  },
                ],
                extensions: {
                  underlyingError: error,
                },
                size: 1000,
              };
              return Promise.resolve(queryRet);
            });
        },
        // If an error occurs while creating the request configuration, create a new query result object with the error message and the underlying error
        (error) => {
          this.pendingRequests -= 1;
          const queryRet: IQueryResult<TReturn> = {
            networkError: true,
            errors: [
              {
                message: typeof error === "string" ? error : "Error initializing request configuration",
              },
            ],
            extensions: {
              underlyingError: error,
            },
            size: 1000,
          };
          return Promise.resolve(queryRet);
        },
      );

    // Return an object with the result promise and an abort function that cancels the request
    const doAbort: () => void = cancelSource
      ? () => {
          cancelSource.abort();
        }
      : () => {};
    return {
      result: ret,
      abort: doAbort,
    };
  };

  public ExecuteQuery = <TReturn, TVariables = undefined>(
    request: IGraphQLRequest<TVariables>,
    cacheMode?: "no-cache" | "cache-first" | "cache-and-network",
    cacheTimeout?: number,
  ) => {
    // Set cache mode based on input or default cache policy
    cacheMode = cacheMode || this.defaultCachePolicy;
    // Set cache timeout based on input or default cache time
    const cacheTimeoutValue = cacheTimeout !== undefined ? cacheTimeout : this.defaultCacheTime;
    // Stringify the request object
    const queryAndVariablesString = JSON.stringify(request);

    // A factory function for creating new cache entries
    const newEntryFactory = (newEntry: ICacheEntry) => {
      // Define the response object for the cache entry
      newEntry.response = {
        result: null,
        resultPromise: null as any,
        loading: false,
        // Refresh function for executing the query and updating the cache entry
        refresh: () => {
          // If already loading, return the promise representing the currently-executing request
          if (newEntry.response.loading) return newEntry.response.resultPromise;
          // Otherwise, start executing the request
          newEntry.response.loading = true;
          const exec = this.ExecuteQueryRaw<TReturn, TVariables>(request);
          newEntry.response.resultPromise = exec.result;
          newEntry.cancelRequest = exec.abort;
          // When the query result is resolved (note: data may contain a sucessful or failed response; the promise will not be rejected)
          exec.result.then((data) => {
            // Check if the query has been force refreshed then discard the original result; otherwise:
            if (newEntry.response.resultPromise === exec.result) {
              // Update the cache entry and notify subscribers
              newEntry.response.result = data;
              newEntry.response.loading = false;
              newEntry.cancelRequest = undefined;
              if (data.errors && data.errors.length) {
                // If there were any errors, immediately expire the cache entry
                newEntry.expires = 0;
              } else {
                // Set the cache entry size
                this.SetCacheEntrySize(newEntry, data.size + 1000);
                // Set the cache entry expiration date
                if (cacheMode !== "no-cache") newEntry.expires = Date.now() + cacheTimeoutValue;
              }
              // Notify all subscribers of the new data
              newEntry.subscribers.forEach((subscriber) => {
                subscriber(data);
              });
            }
          });
          // Return a promise that resolves when the GraphQL operation is complete
          // (note: data may contain a sucessful or failed response; the promise will not be rejected)
          return exec.result;
        },
        // Function to force refresh the cache entry
        forceRefresh: () => {
          // If in the process of loading, terminate the request, discard the results and retry
          if (newEntry.response.loading) {
            if (newEntry.cancelRequest) {
              newEntry.cancelRequest();
            }
            newEntry.cancelRequest = undefined;
            newEntry.response.loading = false;
            newEntry.response.resultPromise = null as any;
            // No need to notify subscribers because it's still loading anyway; no data would have been sent
          }
          // Execute the GraphQL request again
          newEntry.response.refresh();
        },
        // Function to clear and refresh the cache entry
        clearAndRefresh: () => {
          // Perform force-refresh
          newEntry.response.forceRefresh();
          // Push out null result to subscribers if anything was sent out already
          if (newEntry.response.result !== null) {
            newEntry.response.result = null;
            newEntry.subscribers.forEach((subscriber) => {
              subscriber(null);
            });
          }
        },
        // Function to subscribe to cache entry updates
        subscribe: (callback) => {
          newEntry.subscribers.push(callback);
          return () => {
            newEntry.subscribers = newEntry.subscribers.filter((x) => x !== callback);
          };
        },
      };
      // Initiate the GraphQL call
      newEntry.response.refresh();
    };
    // Get or create a cache entry using the factory function
    const newEntry = this.GetOrCreateCacheEntry(queryAndVariablesString, newEntryFactory, cacheMode === "no-cache");
    // If there are no subscribers and the cache mode is "cache-and-network" or the cache entry has expired, refresh the cache entry
    // (note: 'no-cache' would have already created a new request)
    // But for "cache-first" mode, or subscribers to a request whose entry has not expired, does not need a refresh
    if (newEntry.subscribers.length === 0 && (cacheMode === "cache-and-network" || newEntry.expires < Date.now())) {
      newEntry.response.refresh();
    }
    // Return the cache entry's response object as an IQueryResponse
    return newEntry.response as IQueryResponse<TReturn>;
  };

  public ExecuteSubscription = <TReturn, TVariables = undefined>(
    request: IGraphQLRequest<TVariables>,
    onData: (data: IQueryResult<TReturn>) => void,
    onClose: () => void,
  ) => {
    this.activeSubscriptions += 1;
    const subscriptionId = "1";
    // set up abort
    let aborted = false;
    let doAbort: () => void = null!;
    const abortPromise = new Promise<void>((doAbort2) => {
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
      if (!aborted) onData(data);
    };
    // set up error close
    const doError = (error: any) => {
      if (aborted) return;
      const queryRet: IQueryResult<TReturn> = {
        networkError: true,
        errors: [
          {
            message: typeof error === "string" ? error : "Error generating websocket connection payload",
          },
        ],
        extensions: {
          underlyingError: error,
        },
        size: 1000,
      };
      onData(queryRet);
      doAbort();
    };

    // set up connection promise
    const connectionPromise = new Promise<void>((resolveConnection, rejectConnection) => {
      let connectionResolved = false;
      abortPromise.then(() => {
        if (!connectionResolved) {
          connectionResolved = true;
          rejectConnection();
        }
      });
      // attempt to generate the connection payload
      let payloadPromise: Promise<{} | undefined>;
      if (this.generatePayload) {
        try {
          payloadPromise = Promise.resolve(this.generatePayload());
        } catch (e) {
          payloadPromise = Promise.reject(e);
        }
      } else {
        payloadPromise = Promise.resolve(undefined);
      }
      payloadPromise.then(
        (payload) => {
          if (aborted) return;
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
            if (aborted) return;
            const message = {
              type: "connection_init",
              payload: payload,
            };
            webSocket.send(JSON.stringify(message));
          };
          // when message received, process it
          webSocket.onmessage = (ev) => {
            // parse the incoming message
            if (aborted) return;
            if (typeof ev.data !== "string") doError("WebSocket data is not string");
            let message: IWebSocketMessage<TReturn> | null;
            try {
              message = JSON.parse(ev.data);
            } catch {
              doError("WebSocket message is not valid JSON");
              return;
            }

            if (message === null) {
              doError("WebSocket message is null");
              return;
            }

            // process message based on state machine
            if (message.type === "ping") {
              webSocket.send(JSON.stringify({ type: "pong", payload: message.payload }));
            } else if (state === "opening") {
              if (message.type !== "connection_ack") {
                // Log WebSocket connection error if the callback is defined
                if (this.logWebSocketConnectionError) {
                  const connectionMessage = {
                    type: "connection_init",
                    payload: payload,
                  };
                  this.logWebSocketConnectionError(request, connectionMessage, message);
                }
                doError("Invalid connection response from WebSocket server");
              } else {
                state = "connected";
                if (!connectionResolved) {
                  connectionResolved = true;
                  resolveConnection();
                }
                webSocket.send(
                  JSON.stringify({
                    id: subscriptionId,
                    type: "subscribe",
                    payload: request,
                  }),
                );
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
                if (!message.payload || message.id !== subscriptionId) {
                  doError("Invalid payload for 'error' packet");
                  return;
                }
                doData({
                  networkError: false,
                  size: (ev.data as string).length,
                  errors: message.payload,
                });
                doAbort();
              } else if (message.type === "complete") {
                if (message.id !== subscriptionId) {
                  doError("Invalid payload for 'complete' packet");
                  return;
                }
                doAbort();
              } else {
                // unknown message type
                doError("Unknown message type from WebSocket server");
              }
            }
          };
          // when websocket closed, notify caller (only raises error if not closed from this end)
          webSocket.onclose = () => {
            doError("WebSocket connection unexpectedly closed");
          };
        },
        // when failed to generate payload, notify caller
        (error) => {
          doError(error);
        },
      );
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
    this.cache.forEach((value) => {
      if (value.subscribers.length > 0) {
        if (force) value.response.forceRefresh();
        else value.response.refresh();
      }
    });
  };

  public ClearCache = () => {
    // expire all cache entries
    // dump cache entries not in use
    // do not refresh cache entries in use
    this.cache.forEach((value) => {
      value.expires = 0;
    });
    this.AllocateCacheSize(this.maxCacheSize);
  };

  public ResetStore = () => {
    // expire all cache entries not in use
    // dump cache entries not in use
    this.ClearCache();
    // refresh all cache entries in use
    this.cache.forEach((value) => {
      value.response.clearAndRefresh();
    });
  };

  private GetOrCreateCacheEntry = (
    queryAndVariablesString: string,
    newEntryFactory: (cacheEntry: ICacheEntry) => void,
    noCache: boolean,
  ) => {
    // this always adds the new entry even if the lifetime is zero
    const valueFromCache = this.cache.get(queryAndVariablesString);
    const nowDate = Date.now();
    if (valueFromCache) {
      if (valueFromCache.subscribers.length > 0 || !noCache) {
        valueFromCache.lastUsed = Date.now();
        return valueFromCache;
      } else {
        if (this.cache.delete(queryAndVariablesString)) this.cacheSize -= valueFromCache.size;
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
  };

  private SetCacheEntrySize = (cacheEntry: ICacheEntry, newSize: number) => {
    const entry = this.cache.get(cacheEntry.queryAndVariablesString);
    if (entry && entry === cacheEntry) {
      this.cacheSize -= entry.size;
      this.AllocateCacheSize(newSize, entry);
      this.cacheSize += entry.size;
    }
    cacheEntry.size = newSize;
  };

  private AllocateCacheSize = (newSize: number, exclude?: ICacheEntry) => {
    //check if we need more space
    const needBytes = this.cacheSize + newSize - this.maxCacheSize;
    if (needBytes <= 0) {
      return;
    }
    //delete expired entries
    const nowDate = Date.now();
    const entriesToRemove: ICacheEntry[] = [];
    this.cache.forEach((value) => {
      //(value, key)
      if (value.subscribers.length === 0 && value.expires < nowDate) {
        entriesToRemove.push(value);
      }
    });
    entriesToRemove.forEach((value) => {
      if (this.cache.delete(value.queryAndVariablesString)) {
        this.cacheSize -= value.size;
      }
    });
    //deleted oldest entry
    do {
      const needBytes = this.cacheSize + newSize - this.maxCacheSize;
      if (needBytes <= 0) break;
      let oldestEntry: ICacheEntry | undefined | null;
      this.cache.forEach((value) => {
        //(value, key)
        if (value.subscribers.length === 0 && value !== exclude) {
          if (!oldestEntry || value.lastUsed < oldestEntry.lastUsed) oldestEntry = value;
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
    } while (true);
  };
}
