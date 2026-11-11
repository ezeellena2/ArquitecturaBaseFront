import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSettledValue } from "./useSettledValue";

describe("useSettledValue", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("gives the value once it stops changing for the delay, keeping the last settled one meanwhile", () => {
    const { result, rerender } = renderHook(({ value }) => useSettledValue(value, 300), { initialProps: { value: "a" } });
    expect(result.current).toBe("a");

    rerender({ value: "ab" });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ value: "abc" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(result.current).toBe("a");

    act(() => { vi.advanceTimersByTime(100); });
    expect(result.current).toBe("abc");
  });

  it("waits 300 milliseconds by default", () => {
    const { result, rerender } = renderHook(({ value }) => useSettledValue(value), { initialProps: { value: 1 } });
    rerender({ value: 2 });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(2);
  });
});
