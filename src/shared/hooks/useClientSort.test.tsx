import "@/shared/i18n";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { SortValue } from "@/shared/lib/sort";
import { useClientSort } from "./useClientSort";

interface Row { id: string; name: string; copies: number | null }

const rows: Row[] = [
  { id: "1", name: "Remito", copies: 2 },
  { id: "2", name: "aplicación", copies: null },
  { id: "3", name: "Árbol 10", copies: 2 },
  { id: "4", name: "Árbol 9", copies: 5 },
];
const values: Record<string, (row: Row) => SortValue> = { name: row => row.name, copies: row => row.copies };
const at = (url: string) => ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;

describe("useClientSort, a whole list ordered in the browser (OT1-C)", () => {
  it("orders by the sort of the URL, without case or accents and with the numbers by their value", () => {
    const { result } = renderHook(() => useClientSort(rows, values), { wrapper: at("/formularios/biblioteca?sort=name") });

    expect(result.current.map(row => row.id)).toEqual(["2", "4", "3", "1"]);
  });

  it("puts the empty ones last and keeps the order in which the rows arrived for the same value", () => {
    const { result } = renderHook(() => useClientSort(rows, values), { wrapper: at("/formularios/biblioteca?sort=-copies") });

    expect(result.current.map(row => row.id)).toEqual(["4", "1", "3", "2"]);
  });

  it("uses the usual order of the list without one in the URL, and leaves the list as it came without either", () => {
    expect(renderHook(() => useClientSort(rows, values, "copies"), { wrapper: at("/formularios/biblioteca") }).result.current.map(row => row.id))
      .toEqual(["1", "3", "4", "2"]);
    expect(renderHook(() => useClientSort(rows, values), { wrapper: at("/formularios/biblioteca") }).result.current).toBe(rows);
  });
});
