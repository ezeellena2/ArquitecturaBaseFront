import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormCulture } from "../model";
import { fetchFormDefinition, fetchFormDefinitions, fetchFormFacets, type FormListQuery } from "../api/forms";

export interface FormReadScope { readonly actorId: string | null; readonly culture: FormCulture; readonly permissions: readonly string[] }
export const formActorKey = (actorId: string | null) => ["business-forms", actorId] as const;
export const formScopeKey = (scope: FormReadScope) => [...formActorKey(scope.actorId), [...new Set(scope.permissions)].sort().join(","), scope.culture] as const;
export const formDetailKey = (scope: FormReadScope, id: string) => [...formScopeKey(scope), "detail", id] as const;
export const canReadForms = (scope: FormReadScope) => scope.actorId !== null && scope.permissions.includes("formtemplates.read");

function usePrivateQueryCleanup(key: readonly unknown[]) {
  const client = useQueryClient();
  // A serialized primitive key keeps cleanup stable across ordinary query renders.
  const stamp = JSON.stringify(key);
  useEffect(() => () => {
    const queryKey: readonly unknown[] = JSON.parse(stamp) as readonly unknown[];
    void client.cancelQueries({ queryKey });
    client.removeQueries({ queryKey });
  }, [client, stamp]);
}
export function useFormDefinitions(scope: FormReadScope, query: FormListQuery) {
  const root = [...formScopeKey(scope), "list"] as const;
  usePrivateQueryCleanup(root);
  const enabled = canReadForms(scope);
  const owner = JSON.stringify(root);
  const [lastLoaded, setLastLoaded] = useState<{ owner: string; data: Awaited<ReturnType<typeof fetchFormDefinitions>> } | null>(null);
  const list = useQuery({ queryKey: [...root, "page", query], queryFn: ({ signal }) => fetchFormDefinitions(query, signal), enabled,
    placeholderData: (previous, previousQuery) => JSON.stringify(previousQuery?.queryKey.slice(0, root.length)) === owner ? keepPreviousData(previous) : undefined,
    gcTime: 0, meta: { errorOwner: "local" } });
  // Retain only a new successful result; a conditional adjustment avoids an extra effect render.
  if (list.data && !list.isPlaceholderData && (lastLoaded?.owner !== owner || lastLoaded.data !== list.data)) setLastLoaded({ owner, data: list.data });
  const facetQuery = { search: query.search };
  const facets = useQuery({ queryKey: [...root, "facets", facetQuery], queryFn: ({ signal }) => fetchFormFacets(facetQuery, signal), enabled,
    gcTime: 0, meta: { errorOwner: "local" } });
  return { list: { ...list, data: list.data ?? (lastLoaded?.owner === owner ? lastLoaded.data : undefined) }, facets };
}
export function useFormDefinition(scope: FormReadScope, id: string) {
  const key = formDetailKey(scope, id);
  usePrivateQueryCleanup(key);
  return useQuery({ queryKey: key, queryFn: ({ signal }) => fetchFormDefinition(id, signal), enabled: canReadForms(scope) && id !== "",
    staleTime: 0, gcTime: 0, meta: { errorOwner: "local" } });
}
