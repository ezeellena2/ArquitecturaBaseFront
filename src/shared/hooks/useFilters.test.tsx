import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { useFilters } from "./useFilters";
import { usePagination } from "./usePagination";

const claves = ["isActive", "role", "createdWithinDays"] as const;

function wrapperFor(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>;
  };
}

/// Los filtros y el paginado escriben en la misma query string: se prueban juntos, porque el riesgo real es
/// que uno pise lo del otro.
function renderFilters(url: string) {
  return renderHook(
    () => ({ filters: useFilters(claves), pagination: usePagination(), location: useLocation() }),
    { wrapper: wrapperFor(url) },
  );
}

describe("useFilters", () => {
  it("reads the filters from the URL", () => {
    const { result } = renderFilters("/usuarios?isActive=false&role=Admin&page=3");

    expect(result.current.filters.values.isActive).toBe("false");
    expect(result.current.filters.values.role).toBe("Admin");
    expect(result.current.filters.values.createdWithinDays).toBeUndefined();
    expect(result.current.filters.active).toEqual(["isActive", "role"]);
  });

  it("writes a filter to the URL and leaves the ones that are not set out of it", () => {
    const { result } = renderFilters("/usuarios");

    act(() => result.current.filters.setFilter("role", "Admin"));

    expect(result.current.location.search).toBe("?role=Admin");
  });

  it("takes a filter out of the URL instead of writing it empty", () => {
    const { result } = renderFilters("/usuarios?role=Admin");

    act(() => result.current.filters.setFilter("role", undefined));

    expect(result.current.location.search).toBe("");
  });

  it("goes back to the first page when a filter changes", () => {
    // Si no, se puede quedar parada en una página que con el filtro nuevo ya no existe, y el listado se ve
    // vacío por un motivo que no tiene nada que ver con el filtro.
    const { result } = renderFilters("/usuarios?page=3");

    act(() => result.current.filters.setFilter("isActive", "true"));

    expect(result.current.pagination.page).toBe(1);
    expect(result.current.location.search).toBe("?isActive=true");
  });

  it("clears every filter and the search, and keeps the sort", () => {
    // El orden no es un filtro: no cambia qué filas hay, solo en qué orden. Limpiar los filtros no tiene
    // por qué devolver la tabla al orden por omisión.
    const { result } = renderFilters("/usuarios?isActive=false&role=Admin&search=ana&sort=-email&page=2");

    act(() => result.current.filters.clear());

    expect(result.current.filters.active).toEqual([]);
    expect(result.current.pagination.search).toBeUndefined();
    expect(result.current.pagination.page).toBe(1);
    expect(result.current.pagination.sort).toBe("-email");
  });

  it("does not accumulate two changes made in the same tick: the second overwrites the first", () => {
    // Queda escrito porque es lo contrario de lo que uno supondría al ver `setParams((previous) => …)`:
    // `previous` es la query string confirmada, no la que dejó pendiente la llamada anterior. De ahí que
    // todo lo que tiene que viajar junto vaya en una sola llamada (el filtro y el reset de página, por
    // ejemplo). Si algún día react-router cambia esto, que se entere este test y no una pantalla.
    const { result } = renderFilters("/usuarios");

    act(() => {
      result.current.filters.setFilter("role", "Admin");
      result.current.filters.setFilter("isActive", "true");
    });

    expect(result.current.filters.active).toEqual(["isActive"]);
  });
});
