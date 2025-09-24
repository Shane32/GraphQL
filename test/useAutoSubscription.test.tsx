import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import useAutoSubscription, { AutoSubscriptionState } from "../src/useAutoSubscription";
import * as useSubscriptionModule from "../src/useSubscription";
import CloseReason from "../src/CloseReason";
import IQueryResult from "../src/IQueryResult";

// Mock useSubscription
jest.mock("../src/useSubscription");
const mockedUseSubscription = useSubscriptionModule.default as jest.MockedFunction<typeof useSubscriptionModule.default>;

describe("useAutoSubscription", () => {
  let mockSubscribe: jest.Mock;
  let mockAbort: jest.Mock;
  let mockConnectedPromise: Promise<void>;
  let resolveConnected: () => void;
  let rejectConnected: (error: Error) => void;
  let onDataCallback: ((data: IQueryResult<any>) => void) | undefined;
  let onCloseCallback: ((reason: CloseReason) => void) | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAbort = jest.fn();

    // Create a controllable promise for connection
    mockConnectedPromise = new Promise((resolve, reject) => {
      resolveConnected = resolve;
      rejectConnected = reject;
    });

    mockSubscribe = jest.fn().mockReturnValue({
      connected: mockConnectedPromise,
      abort: mockAbort,
    });

    mockedUseSubscription.mockImplementation((query, options) => {
      onDataCallback = options?.onData;
      onCloseCallback = options?.onClose;
      return [mockSubscribe];
    });
  });

  it("should start in disconnected state when enabled is false", () => {
    const { result } = renderHook(() => useAutoSubscription("subscription { test }", { enabled: false }));

    expect(result.current.state).toBe(AutoSubscriptionState.Disconnected);
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("should automatically connect when enabled is true (default)", async () => {
    const { result } = renderHook(() => useAutoSubscription("subscription { test }"));

    expect(result.current.state).toBe(AutoSubscriptionState.Connecting);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });
  });

  it("should transition to error state on connection failure", async () => {
    const { result } = renderHook(() => useAutoSubscription("subscription { test }"));

    expect(result.current.state).toBe(AutoSubscriptionState.Connecting);

    act(() => {
      rejectConnected(new Error("Connection failed"));
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Error);
    });
  });

  it("should disconnect when enabled changes from true to false", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useAutoSubscription("subscription { test }", { enabled }), {
      initialProps: { enabled: true },
    });

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });

    // Disable the subscription
    rerender({ enabled: false });

    expect(mockAbort).toHaveBeenCalledTimes(1);
    expect(result.current.state).toBe(AutoSubscriptionState.Disconnected);
  });

  it("should reconnect when enabled changes from false to true", async () => {
    const { result, rerender } = renderHook(({ enabled }) => useAutoSubscription("subscription { test }", { enabled }), {
      initialProps: { enabled: false },
    });

    expect(result.current.state).toBe(AutoSubscriptionState.Disconnected);
    expect(mockSubscribe).not.toHaveBeenCalled();

    // Enable the subscription
    rerender({ enabled: true });

    expect(result.current.state).toBe(AutoSubscriptionState.Connecting);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });
  });

  it("should support variables as a function", () => {
    const variablesFn = jest.fn().mockReturnValue({ id: "123" });

    renderHook(() =>
      useAutoSubscription("subscription { test }", {
        variables: variablesFn,
      }),
    );

    expect(variablesFn).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalledWith({
      variables: { id: "123" },
    });
  });

  it("should support variables as a static value", () => {
    const variables = { id: "456" };

    renderHook(() =>
      useAutoSubscription("subscription { test }", {
        variables,
      }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith({
      variables: { id: "456" },
    });
  });

  it("should call onOpen callback when successfully connected", async () => {
    const onOpen = jest.fn();

    const { result } = renderHook(() => useAutoSubscription("subscription { test }", { onOpen }));

    expect(result.current.state).toBe(AutoSubscriptionState.Connecting);
    expect(onOpen).not.toHaveBeenCalled();

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("should use the latest onOpen callback", async () => {
    const onOpen1 = jest.fn();
    const onOpen2 = jest.fn();

    const { result, rerender } = renderHook(({ onOpen }) => useAutoSubscription("subscription { test }", { onOpen }), {
      initialProps: { onOpen: onOpen1 },
    });

    // Update the onOpen callback before connection completes
    rerender({ onOpen: onOpen2 });

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });

    // Should call the latest onOpen callback
    expect(onOpen1).not.toHaveBeenCalled();
    expect(onOpen2).toHaveBeenCalledTimes(1);
  });

  it("should call onData callback when data is received", async () => {
    const onData = jest.fn();
    const testData: IQueryResult<any> = {
      data: { test: "value" },
      networkError: false,
      size: 0,
    };

    renderHook(() => useAutoSubscription("subscription { test }", { onData }));

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(onDataCallback).toBeDefined();
    });

    act(() => {
      onDataCallback?.(testData);
    });

    expect(onData).toHaveBeenCalledWith(testData);
  });

  it("should transition to error state when subscription closes with error", async () => {
    const onClose = jest.fn();

    const { result } = renderHook(() => useAutoSubscription("subscription { test }", { onClose }));

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });

    act(() => {
      onCloseCallback?.(CloseReason.Error);
    });

    expect(result.current.state).toBe(AutoSubscriptionState.Error);
    expect(onClose).toHaveBeenCalledWith(CloseReason.Error);
  });

  it("should transition to error state when subscription times out", async () => {
    const onClose = jest.fn();

    const { result } = renderHook(() => useAutoSubscription("subscription { test }", { onClose }));

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });

    act(() => {
      onCloseCallback?.(CloseReason.Timeout);
    });

    expect(result.current.state).toBe(AutoSubscriptionState.Error);
    expect(onClose).toHaveBeenCalledWith(CloseReason.Timeout);
  });

  it("should transition to disconnected state when subscription closes normally", async () => {
    const onClose = jest.fn();

    const { result } = renderHook(() => useAutoSubscription("subscription { test }", { onClose }));

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });

    act(() => {
      onCloseCallback?.(CloseReason.Server);
    });

    expect(result.current.state).toBe(AutoSubscriptionState.Disconnected);
    expect(onClose).toHaveBeenCalledWith(CloseReason.Server);
  });

  it("should abort subscription on unmount", () => {
    const { unmount } = renderHook(() => useAutoSubscription("subscription { test }"));

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    unmount();

    expect(mockAbort).toHaveBeenCalledTimes(1);
  });

  it("should pass through all subscription options", () => {
    const options = {
      guest: true,
      client: "testClient",
      operationName: "TestOperation",
      extensions: { test: "extension" },
      timeoutStrategy: null,
    };

    renderHook(() => useAutoSubscription("subscription { test }", options));

    const callArgs = mockedUseSubscription.mock.calls[0][1];
    expect(callArgs).toMatchObject({
      guest: true,
      client: "testClient",
      operationName: "TestOperation",
      extensions: { test: "extension" },
      timeoutStrategy: null,
    });
  });

  it("should not create duplicate subscriptions", async () => {
    const { result, rerender } = renderHook(() => useAutoSubscription("subscription { test }"));

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    // Trigger a re-render without changing props
    rerender();

    // Should still only have one subscription
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    act(() => {
      resolveConnected();
    });

    await waitFor(() => {
      expect(result.current.state).toBe(AutoSubscriptionState.Connected);
    });

    // Re-render again after connected
    rerender();

    // Should still only have one subscription
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
  });

  it("should re-evaluate variables function on each connection", async () => {
    let counter = 0;
    const variablesFn = jest.fn().mockImplementation(() => ({
      id: `id-${++counter}`,
    }));

    const { rerender } = renderHook(
      ({ enabled }) =>
        useAutoSubscription("subscription { test }", {
          variables: variablesFn,
          enabled,
        }),
      { initialProps: { enabled: true } },
    );

    // Variables function is called once when subscribing
    expect(variablesFn).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenCalledWith({
      variables: { id: "id-1" },
    });

    // Disable and re-enable
    rerender({ enabled: false });
    mockAbort.mockClear();
    variablesFn.mockClear();

    rerender({ enabled: true });

    // Variables function should be called again with new values
    expect(variablesFn).toHaveBeenCalledTimes(1);
    expect(mockSubscribe).toHaveBeenLastCalledWith({
      variables: { id: "id-2" },
    });
  });
});
