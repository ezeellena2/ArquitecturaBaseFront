const fullKeys = ["sort", "sortFieldId", "versionIds"] as const;
const sheetKeys = ["page", "pageSize", ...fullKeys, "columns", "approvalPage", "approvalPageSize"] as const;

function withPublicSearch(path: string, search: string, keys: readonly string[]): string {
  const source = new URLSearchParams(search);
  const target = new URLSearchParams();
  for (const key of keys) {
    const value = source.get(key);
    if (value) target.set(key, value);
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

