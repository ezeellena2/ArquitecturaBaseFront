import type { CatalogImportPreview } from "@/features/business-forms/api/catalogImports";
// Explicit synthetic DTO for behavior; actual HTTP producer exports are qualified separately.
export const importCatalogId = "01990000-0000-7000-8000-000000000020";
export function catalogImportPreviewFixture(): CatalogImportPreview {
  return { catalogId: importCatalogId, revision: 7, mode: "Replace", sheetSha256: "a".repeat(64), sheetName: "Proveedores", rowsRead: 2,
    counts: { added: 1, changed: 0, deactivated: 1, reactivated: 0, unchanged: 0, errorRows: 1, warnings: 0 },
    issues: [{ row: 3, column: "code", severity: "Error", code: "Forms.CatalogImport.DuplicateCode", message: "Repetido: también está en otra fila.", relatedRow: 2, length: null }],
    added: [{ row: 2, code: "N", text: "Norte", value: null }], changed: [], deactivated: [{ itemId: "01990000-0000-7000-8000-000000000021", code: "S", text: "Sur" }],
    listsTruncated: false, confirmations: { deactivations: 1, emptySheet: false, manyErrors: true }, alreadyAppliedAtUtc: null };
}
