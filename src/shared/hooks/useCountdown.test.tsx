import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCountdown } from "./useCountdown";

describe("useCountdown", () => {
  let monotonicNow = 0;

  beforeEach(() => {
    monotonicNow = 0;
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.spyOn(performance, "now").mockImplementation(() => monotonicNow);
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function advance(milliseconds: number) {
    act(() => {
      monotonicNow += milliseconds;
      vi.advanceTimersByTime(milliseconds);
    });
  }

  it("starts idle at zero without scheduling a timer", () => {
    const { result } = renderHook(() => useCountdown(0));

    expect(result.current.seconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("counts elapsed seconds and stops at zero", () => {
    const { result } = renderHook(() => useCountdown(3));

    advance(1000);
    expect(result.current.seconds).toBe(2);
    expect(result.current.isRunning).toBe(true);

    advance(2000);
    expect(result.current.seconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses elapsed time when a suspended timer finally wakes", () => {
    const { result } = renderHook(() => useCountdown(60));

    monotonicNow = 45_000;
    act(() => vi.advanceTimersByTime(1000));

    expect(result.current.seconds).toBe(15);
    expect(result.current.isRunning).toBe(true);
  });

  it("recomputes immediately when a suspended tab becomes visible", () => {
    const { result } = renderHook(() => useCountdown(30));

    monotonicNow = 31_000;
    act(() => document.dispatchEvent(new Event("visibilitychange")));

    expect(result.current.seconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not recompute on a transition to hidden", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    const { result } = renderHook(() => useCountdown(30));

    monotonicNow = 12_000;
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.seconds).toBe(30);

    visibility.mockReturnValue("visible");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(result.current.seconds).toBe(18);
  });

  it("ignores wall clock changes", () => {
    const { result } = renderHook(() => useCountdown(3));
    vi.spyOn(Date, "now").mockReturnValue(9_999_999);

    advance(1000);
    expect(result.current.seconds).toBe(2);
  });

  it("restarts from the current time even with the same displayed seconds", () => {
    const { result } = renderHook(() => useCountdown(3));

    advance(500);
    act(() => result.current.restart(3));
    advance(500);

    expect(result.current.seconds).toBe(3);

    advance(500);
    expect(result.current.seconds).toBe(2);
    advance(2000);
    expect(result.current.seconds).toBe(0);
  });

  it("preserves the functional restart API and stops on restart to zero", () => {
    const { result } = renderHook(() => useCountdown(3));

    act(() => result.current.restart((seconds) => seconds + 2));
    expect(result.current.seconds).toBe(5);

    act(() => result.current.restart(0));
    expect(result.current.seconds).toBe(0);
    expect(result.current.isRunning).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses initialSeconds only when mounting", () => {
    const { result, rerender } = renderHook(({ initialSeconds }) => useCountdown(initialSeconds), {
      initialProps: { initialSeconds: 3 },
    });

    rerender({ initialSeconds: 99 });
    advance(1000);

    expect(result.current.seconds).toBe(2);
  });

  it("keeps one timer in Strict Mode and cleans up the timer and visibility listener", () => {
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;
    const { result, unmount } = renderHook(() => useCountdown(3), { wrapper });

    expect(vi.getTimerCount()).toBe(1);
    advance(1000);
    expect(result.current.seconds).toBe(2);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
    const listeners = added.mock.calls.filter(([event]) => event === "visibilitychange");
    expect(listeners).not.toHaveLength(0);
    for (const [event, listener] of listeners) {
      expect(removed).toHaveBeenCalledWith(event, listener);
    }
  });
});
