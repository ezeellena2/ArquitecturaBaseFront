import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { usePagination } from "./usePagination";

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter initialEntries={["/usuarios?page=2&sort=-email&search=ana"]}>{children}</MemoryRouter>;
}

describe("usePagination", () => {
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

    act(() => result.current.toggleSort("email"));
    expect(result.current.sort).toBe("email");

    act(() => result.current.toggleSort("email"));
    expect(result.current.sort).toBe("-email");
  });
});
