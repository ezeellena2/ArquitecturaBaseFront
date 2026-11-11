import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFormLibrary } from "../api/library";
import type { FormReadScope } from "./useFormQueries";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

/** BI1-A: the key of «Biblioteca» by actor, menu language and permissions, the same for the screen and for the editor's header. */
export const formLibraryKey = (scope: Pick<FormReadScope, "actorId" | "culture" | "permissions">) =>
  ["form-library", scope.actorId, scope.culture, [...new Set(scope.permissions)].sort().join(",")] as const;

/**
 * The library as the installed modules bring it, read again each time it is looked at (gcTime and staleTime 0). Its failure goes
 * to the common notice; `silent` leaves it to a caller that has its own fallback, as the editor's header, which names the key.
 */
export function useFormLibrary(scope: Pick<FormReadScope, "actorId" | "culture" | "permissions">, { enabled = true, silent = false }: { enabled?: boolean; silent?: boolean } = {}) {
  const key = useMemo(() => formLibraryKey(scope), [scope]);
  useUnobservedQueryCleanup(key);
  return useQuery({ queryKey: key, queryFn: ({ signal }) => fetchFormLibrary(signal), enabled: enabled && scope.actorId !== null,
    gcTime: 0, staleTime: 0, retry: false, ...silent ? { meta: { errorOwner: "local" } } : {} });
}
