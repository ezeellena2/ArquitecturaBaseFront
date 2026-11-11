import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFormLibrary } from "../api/library";
import { standardName } from "../boundQuestions";
import type { FormDefinitionStandard } from "../model";
import type { FormReadScope } from "./useFormQueries";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

/**
 * BI1-A: the name of the library standard a form was copied from, as «Biblioteca» lists it in the menu language, read with the
 * same key as that screen. Without the standard nothing is read; while it loads, if it fails or the library no longer lists it,
 * the name is its key: it only names where the form came from, so a failure has no notice of its own.
 */
export function useFormStandardName(scope: FormReadScope, standard: FormDefinitionStandard | undefined): string | null {
  const root = useMemo(() => ["form-library", scope.actorId, scope.culture, [...scope.permissions].sort().join(",")] as const,
    [scope.actorId, scope.culture, scope.permissions]);
  useUnobservedQueryCleanup(root);
  const library = useQuery({ queryKey: root, queryFn: ({ signal }) => fetchFormLibrary(signal), enabled: !!standard && scope.actorId !== null,
    gcTime: 0, staleTime: 0, retry: false, meta: { errorOwner: "local" } });
  return standard ? standardName(standard, library.data?.standards) : null;
}
