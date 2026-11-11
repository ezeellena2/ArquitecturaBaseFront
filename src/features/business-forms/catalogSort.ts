import type { CatalogItemSort } from "./api/catalogs";
import type { CatalogFieldDraft } from "./catalogFields";
import { administrativeName } from "./editorModel";
import type { FormCulture } from "./model";

/** The words of a direction follow the column's data: letters for a text, a code or an option of another catalog. */
export type CatalogSortKind = "text" | "number" | "date" | "yesNo";

/** The fields «Ordenar por…» offers, in the table's order: saved and active. A field added in the draft has no values yet. */
export const catalogSortFields = (fields: readonly CatalogFieldDraft[]) => fields.filter(field => field.id !== null && field.isActive);

export function catalogSortKind(column: string, fields: readonly CatalogFieldDraft[]): CatalogSortKind {
  const type = fields.find(field => field.id === column)?.type;
  return type === "integer" || type === "decimal" ? "number" : type === "date" ? "date" : type === "boolean" ? "yesNo" : "text";
}

/** The column's name as the table's header says it; `labels` are the headers of Texto and Código. */
export function catalogSortColumnName(sort: CatalogItemSort, fields: readonly CatalogFieldDraft[], culture: FormCulture,
  labels: Readonly<Record<"text" | "code", string>>): string {
  if (sort.column === "text" || sort.column === "code") return labels[sort.column];
  return administrativeName(fields.find(field => field.id === sort.column)?.name, culture);
}
