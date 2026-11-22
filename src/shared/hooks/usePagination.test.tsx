import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { usePagination } from "./usePagination";

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/usuarios?page=2&sort=-email&search=ana"]}>{children}</MemoryRouter>;
}

describe("usePagination", () => {
  it("uses the system default and resets the page when size changes", () => {
    const { result } = renderHook(() => usePagination(50), { wrapper });
    expect(result.current.pageSize).toBe(50);
    act(() => result.current.setPageSize(10));
    expect(result.current.pageSize).toBe(10);
    expect(result.current.page).toBe(1);
  });
  it("reads the state from the URL", () => {
    const { result } = renderHook(() => usePagination(), { wrapper });

    expect(result.current.page).toBe(2);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.sort).toBe("-email");
    expect(result.current.search).toBe("ana");
  });

  it("resets to the first page when the search changes", () => {
    const { result } = renderHook(() => usePagination(), { wrapper });

    act(() => result.current.setSearch("beto"));

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("beto");
  });

  it("toggles the sort direction of the same field", () => {
    const { result } = renderHook(() => usePagination(), { wrapper });

    act(() => result.current.toggleSort("email", "text"));
    expect(result.current.sort).toBe("email");

    act(() => result.current.toggleSort("email", "text"));
    expect(result.current.sort).toBe("-email");
  });

  // OT1-C (2026-11-22): the first touch orders in the useful direction of the datum and goes back to the first page, without
  // touching the search or the filters.
  it.each([
    ["createdAtUtc", "date", "-createdAtUtc"],
    ["userCount", "number", "-userCount"],
    ["verified", "yesNo", "-verified"],
    ["displayName", "text", "displayName"],
    ["state", "state", "state"],
  ] as const)("starts %s (%s) as %s, back on the first page and with the other parameters", (field, kind, expected) => {
    const { result } = renderHook(() => ({ pagination: usePagination(), params: useSearchParams()[0] }), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/usuarios?page=2&sort=-email&search=ana&role=Admin"]}>{children}</MemoryRouter>,
    });

    act(() => result.current.pagination.toggleSort(field, kind));

    expect(result.current.pagination.sort).toBe(expected);
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.params.get("search")).toBe("ana");
    expect(result.current.params.get("role")).toBe("Admin");
  });

  it("inverts the usual order of the list on the first touch when that order is the column", () => {
    const { result } = renderHook(() => usePagination(undefined, false, "-receivedAtUtc"), {
      wrapper: ({ children }) => <MemoryRouter initialEntries={["/formularios/documentos"]}>{children}</MemoryRouter>,
    });

    expect(result.current.sort).toBeUndefined();
    act(() => result.current.toggleSort("receivedAtUtc", "date"));
    expect(result.current.sort).toBe("receivedAtUtc");
  });

  it("writes the order chosen in «Ordenar por» and goes back to the first page", () => {
    const { result } = renderHook(() => usePagination(), { wrapper });

    act(() => result.current.setSort("-lastSubmittedAtUtc"));

    expect(result.current.sort).toBe("-lastSubmittedAtUtc");
    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("ana");
  });
});
