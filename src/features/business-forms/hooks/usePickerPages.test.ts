import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PagedResult } from "@/shared/api/pagedResult";
import { usePickerPages, type PickerPagesQuery } from "./usePickerPages";

interface Row { id: string; name: string }
const page = (items: Row[], number: number, totalCount: number): PagedResult<Row> =>
  ({ items, page: number, pageSize: 2, totalCount, totalPages: Math.ceil(totalCount / 2), hasPrevious: number > 1, hasNext: number * 2 < totalCount });
const answer = (data?: PagedResult<Row>, flags: Partial<PickerPagesQuery<Row>> = {}): PickerPagesQuery<Row> =>
  ({ data, isPlaceholderData: false, isFetching: false, isError: false, ...flags });
const [a, b, c] = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];

describe("usePickerPages", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("waits for the first page, then shows it with how many there are and asks for the next one", () => {
    const { result } = renderHook(() => usePickerPages<Row>());

    expect(result.current.page).toBe(1);
    expect(result.current.list(answer(undefined, { isFetching: true }))).toMatchObject({ options: [], loading: true, failed: false });
    const first = result.current.list(answer(page([a, b], 1, 3)));
    expect(first).toMatchObject({ options: [a, b], loading: false, total: 3, pageSize: 1 });

    act(() => first.onLoadMore?.());
    expect(result.current.page).toBe(2);
    // While the next page arrives the ones in sight stay, and asking again does not skip a page.
    const waiting = result.current.list(answer(page([a, b], 1, 3), { isPlaceholderData: true, isFetching: true }));
    expect(waiting).toMatchObject({ options: [a, b], loading: false, loadingMore: true });
    act(() => waiting.onLoadMore?.());
    expect(result.current.page).toBe(2);
    expect(result.current.list(answer(page([c], 2, 3)))).toMatchObject({ options: [a, b, c], loadingMore: false, onLoadMore: undefined });
  });

  it("waits 300 ms for what is typed and starts the search again from the first page", () => {
    const { result } = renderHook(() => usePickerPages<Row>());
    act(() => result.current.list(answer(page([a, b], 1, 3))).onLoadMore?.());
    expect(result.current.page).toBe(2);

    act(() => result.current.onSearchChange(" c "));
    expect(result.current.settled).toBe("");
    expect(result.current.list(answer(page([c], 2, 3)))).toMatchObject({ options: [], loading: true });
    act(() => { vi.advanceTimersByTime(300); });

    expect(result.current.settled).toBe("c");
    expect(result.current.page).toBe(1);
    expect(result.current.list(answer(page([c], 2, 3), { isPlaceholderData: true, isFetching: true }))).toMatchObject({ options: [], loading: true });
    expect(result.current.list(answer(page([c], 1, 1)))).toMatchObject({ options: [c], loading: false });
  });

  it("says it failed instead of showing an answer, and waits again while it retries", () => {
    const { result } = renderHook(() => usePickerPages<Row>());

    expect(result.current.list(answer(page([a, b], 1, 3), { isError: true }))).toMatchObject({ options: [], failed: true, loading: false, onLoadMore: undefined });
    expect(result.current.list(answer(page([a, b], 1, 3), { isError: true, isFetching: true }))).toMatchObject({ options: [], failed: false, loading: true });
  });
});
