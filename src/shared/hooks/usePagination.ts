import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router";
import { toggledSort, type SortKind } from "@/shared/lib/sort";
import { useQueryUpdate } from "./useQueryUpdate";

export const defaultPageSize = 20;

/// Página, orden y búsqueda viven en la URL: el listado se puede compartir y el botón atrás funciona.
/// `defaultSort` es el orden de siempre de la lista cuando es una columna: no va en la URL, pero el primer toque en esa
/// columna la invierte, como si se hubiera elegido.
export function usePagination(configuredSize?: number, waitForDefault = false, defaultSort?: string) {
  const [params] = useSearchParams();

  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? configuredSize ?? defaultPageSize);
  const ready = params.has("pageSize") || !waitForDefault || configuredSize !== undefined;
  const sort = params.get("sort") ?? undefined;
  const search = params.get("search") ?? undefined;

  const update = useQueryUpdate();

  // Fijar el tamaño al abrir evita que un cambio general altere un listado ya abierto.
  useEffect(() => {
    if (ready && (waitForDefault || configuredSize !== undefined) && !params.has("pageSize")) update({ pageSize: String(pageSize) });
  }, [ready, waitForDefault, configuredSize, params, pageSize, update]);

  const setPage = useCallback((next: number) => update({ page: next === 1 ? undefined : String(next) }), [update]);
  const setPageSize = useCallback((next: number) => update({ pageSize: String(next), page: undefined }), [update]);

  // Cambiar la búsqueda o el orden vuelve a la primera página: si no, se puede quedar en una página que ya no existe.
  const setSearch = useCallback((next: string) => update({ search: next, page: undefined }), [update]);

  // El encabezado (OT1-C): el primer toque en el sentido útil del dato y el segundo lo invierte. Los demás parámetros
  // (búsqueda, solapas, filtros) quedan como están.
  const toggleSort = useCallback(
    (field: string, kind: SortKind) => update({ sort: toggledSort(sort ?? defaultSort, field, kind), page: undefined }),
    [sort, defaultSort, update],
  );
  // «Ordenar por» elige la columna y el sentido.
  const setSort = useCallback((next: string) => update({ sort: next, page: undefined }), [update]);

  return useMemo(
    () => ({ page, pageSize, sort, search, ready, setPage, setPageSize, setSearch, toggleSort, setSort }),
    [page, pageSize, sort, search, ready, setPage, setPageSize, setSearch, toggleSort, setSort],
  );
}
