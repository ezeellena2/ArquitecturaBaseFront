import { useQuery } from "@tanstack/react-query";
import { fetchAssistantCatalogImport } from "../api/catalogImports";
import type { CatalogReadScope } from "./useCatalogDraftEditor";

/**
 * The import still pending in a catalog created from a proposal with a spreadsheet (IA2): read once per load of the page, without
 * keeping it after, and only for whoever reads and manages catalogs. A failure only leaves the import to be opened by hand.
 */
export function useAssistantCatalogImport(scope: CatalogReadScope, catalogId: string | null, enabled: boolean) {
  const allowed = !!scope.actorId && scope.permissions.includes("formcatalogs.read") && scope.permissions.includes("formcatalogs.manage");
  return useQuery({
    queryKey: ["form-catalog-assistant-import", scope.actorId, catalogId],
    queryFn: ({ signal }) => fetchAssistantCatalogImport(catalogId!, signal),
    enabled: enabled && allowed && !!catalogId,
    staleTime: Infinity, gcTime: 0, retry: false, refetchOnWindowFocus: false,
  });
}
