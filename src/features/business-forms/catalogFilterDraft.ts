import type { CatalogFiltersEditorValue } from "./components/CatalogFiltersEditor";

// Valid editor values map directly to the current FormCatalogFilterDefinition DTO.
export interface CatalogFiltersBody {
  readonly textColumn: string;
  readonly detailColumn: string | null;
  readonly conditions: readonly { readonly column: string; readonly operator: string; readonly value: string }[];
  readonly excludeRecipient: boolean;
  readonly sortColumn: string;
  readonly sortDescending: boolean;
}
export function catalogFiltersBody(value: CatalogFiltersEditorValue): CatalogFiltersBody {
  return { textColumn: value.textColumn, detailColumn: value.detailColumn,
    conditions: value.conditions.map(condition => ({ column: condition.column, operator: condition.operator, value: condition.value })),
    excludeRecipient: value.excludeRecipient, sortColumn: value.sortColumn, sortDescending: value.sortDescending };
}
export function openCatalogFilters(filters: CatalogFiltersBody): CatalogFiltersEditorValue {
  return { ...filters, conditions: filters.conditions.map(condition => ({ ...condition, localId: crypto.randomUUID() })) };
}
