import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";
import { useQueryUpdate } from "./useQueryUpdate";

export const defaultPageSize = 20;

/// Página, orden y búsqueda viven en la URL: el listado se puede compartir y el botón atrás funciona.
export function usePagination() {
  const [params] = useSearchParams();

  const page = Number(params.get("page") ?? 1);
  const pageSize = Number(params.get("pageSize") ?? defaultPageSize);
  const sort = params.get("sort") ?? undefined;
  const search = params.get("search") ?? undefined;

  const update = useQueryUpdate();

  const setPage = useCallback((next: number) => update({ page: next === 1 ? undefined : String(next) }), [update]);

  // Cambiar la búsqueda o el orden vuelve a la primera página: si no, se puede quedar en una página que ya no existe.
  const setSearch = useCallback((next: string) => update({ search: next, page: undefined }), [update]);

  const toggleSort = useCallback(
    (field: string) => update({ sort: sort === field ? `-${field}` : field, page: undefined }),
    [sort, update],
  );

  return useMemo(
    () => ({ page, pageSize, sort, search, setPage, setSearch, toggleSort }),
    [page, pageSize, sort, search, setPage, setSearch, toggleSort],
  );
}
