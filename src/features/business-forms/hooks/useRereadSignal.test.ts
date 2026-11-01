import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { useRereadSignal } from "./useRereadSignal";

it("signals only the read that the person's action asked for, until its rows or its failure arrive", () => {
  const { result, rerender } = renderHook(props => useRereadSignal(props), { initialProps: { isFetching: false, dataUpdatedAt: 1 } });
  rerender({ isFetching: true, dataUpdatedAt: 1 });
  expect(result.current.rereading).toBe(false);
  rerender({ isFetching: false, dataUpdatedAt: 2 });
  act(() => result.current.mark());
  rerender({ isFetching: true, dataUpdatedAt: 2 });
  expect(result.current.rereading).toBe(true);
  rerender({ isFetching: false, dataUpdatedAt: 3 });
  expect(result.current.rereading).toBe(false);
  rerender({ isFetching: true, dataUpdatedAt: 3 });
  expect(result.current.rereading).toBe(false);
  act(() => result.current.mark());
  rerender({ isFetching: false, dataUpdatedAt: 3 });
  expect(result.current.rereading).toBe(false);
});
