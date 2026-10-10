import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const list = useQuery({ queryKey: [...root, "page", query], queryFn: ({ signal }) => fetchFormDefinitions(query, signal), enabled,
    gcTime: 0, meta: { errorOwner: "local" } });
  const facets = useQuery({ queryKey: [...root, "facets", query], queryFn: ({ signal }) => fetchFormFacets(query, signal), enabled,
    gcTime: 0, meta: { errorOwner: "local" } });
  return { list, facets };
}
export function useFormDefinition(scope: FormReadScope, id: string) {
  const key = formDetailKey(scope, id);
  usePrivateQueryCleanup(key);
  return useQuery({ queryKey: key, queryFn: ({ signal }) => fetchFormDefinition(id, signal), enabled: canReadForms(scope) && id !== "",
    staleTime: 0, gcTime: 0, meta: { errorOwner: "local" } });
}
