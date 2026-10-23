import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchCatalog, fetchCatalogItems, fetchCatalogPage, type CatalogItemsQuery, type CatalogListQuery, fetchCatalogFilterOptions, type CatalogFilterOptionsQuery } from "../api/catalogs";
import type { CatalogReadScope } from "./useCatalogDraftEditor";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

export const catalogActorKey = (actorId: string | null) => ["form-catalogs", actorId] as const;
export const catalogScopeKey = (scope: CatalogReadScope) => [...catalogActorKey(scope.actorId), [...new Set(scope.permissions)].sort().join(","), scope.culture] as const;
const canRead = (scope: CatalogReadScope) => scope.actorId !== null && scope.permissions.includes("formcatalogs.read");
export function useCatalogDetail(scope: CatalogReadScope, id: string, errorOwner: "local" | "global" = "local") {
  const key = [...catalogScopeKey(scope), "detail", id] as const;
  useUnobservedQueryCleanup(key);
  return useQuery({ queryKey: key, queryFn: ({ signal }) => fetchCatalog(id, signal), enabled: canRead(scope) && id !== "", staleTime: 0, gcTime: 0, meta: { errorOwner } });
}
export function useCatalogItems(scope: CatalogReadScope, id: string, revision: number | null, query: CatalogItemsQuery, errorOwner: "local" | "global" = "local") {
  const root = [...catalogScopeKey(scope), "items", id, revision] as const;
  useUnobservedQueryCleanup(root);
  return useQuery({ queryKey: [...root, query], queryFn: ({ signal }) => fetchCatalogItems(id, query, signal), enabled: canRead(scope) && id !== "" && revision !== null, staleTime: 0, gcTime: 0, meta: { errorOwner } });
}

export function useCatalogPage(scope: CatalogReadScope, query: CatalogListQuery, errorOwner: "local" | "global" = "local") {
  const root = [...catalogScopeKey(scope), "list"] as const;
  useUnobservedQueryCleanup(root);
  const owner = JSON.stringify(root);
  const [lastLoaded, setLastLoaded] = useState<{ owner: string; data: Awaited<ReturnType<typeof fetchCatalogPage>> } | null>(null);
  const list = useQuery({ queryKey: [...root, query], queryFn: ({ signal }) => fetchCatalogPage(query, signal), enabled: canRead(scope),
    placeholderData: (previous, previousQuery) => JSON.stringify(previousQuery?.queryKey.slice(0, root.length)) === owner ? keepPreviousData(previous) : undefined,
    gcTime: 0, meta: { errorOwner } });
  if (list.data && !list.isPlaceholderData && (lastLoaded?.owner !== owner || lastLoaded.data !== list.data)) setLastLoaded({ owner, data: list.data });
  return { ...list, data: list.data ?? (lastLoaded?.owner === owner ? lastLoaded.data : undefined) };
}

export function useCatalogFilterOptions(scope: CatalogReadScope, query: CatalogFilterOptionsQuery) {
  const root = [...catalogScopeKey(scope), "filter-options"] as const;
  useUnobservedQueryCleanup(root);
  const owner = JSON.stringify(root);
  const [lastLoaded, setLastLoaded] = useState<{ owner: string; data: Awaited<ReturnType<typeof fetchCatalogFilterOptions>> } | null>(null);
  const options = useQuery({ queryKey: [...root, query], queryFn: ({ signal }) => fetchCatalogFilterOptions(query, signal), enabled: canRead(scope),
    placeholderData: (previous, previousQuery) => JSON.stringify(previousQuery?.queryKey.slice(0, root.length)) === owner ? keepPreviousData(previous) : undefined,
    gcTime: 0, meta: { errorOwner: "local" } });
  if (options.data && !options.isPlaceholderData && (lastLoaded?.owner !== owner || lastLoaded.data !== options.data)) setLastLoaded({ owner, data: options.data });
  return { ...options, data: options.data ?? (lastLoaded?.owner === owner ? lastLoaded.data : undefined) };
}
