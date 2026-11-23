// `view` travels only as «Por resolver» (F2): that tab changes which responses the full view walks and where it goes back. The
// order carries the ids of its column (OT1-C).
const fullKeys = ["sort", "sortFieldId", "sortCatalogFieldId", "sortResultId", "versionIds", "view"] as const;
const sheetKeys = ["page", "pageSize", ...fullKeys, "columns", "approvalPage", "approvalPageSize"] as const;

function withPublicSearch(path: string, search: string, keys: readonly string[]): string {
  const source = new URLSearchParams(search);
  const target = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value && (key !== "view" || value === "unresolved")) target.set(key, value);
  }
  const query = target.toString();
  return path + (query ? "?" + query : "");
}
export function responseFullPath(formId: string, recordId: string, search: string): string {
  return withPublicSearch("/formularios/" + encodeURIComponent(formId) + "/respuestas/" + encodeURIComponent(recordId) + "/completa", search, fullKeys);
}
export function responseSheetPath(formId: string, search: string): string {
  return withPublicSearch("/formularios/" + encodeURIComponent(formId) + "/respuestas", search, sheetKeys);
}

