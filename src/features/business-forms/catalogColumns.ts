import { isNumericType, type CatalogValueType } from "./catalogValues";
import type { FormCulture } from "./model";
import type { CatalogFieldDraft } from "./catalogFields";

export type CatalogItemColumnId = "text" | "code" | "value" | "detail" | "isActive" | `field:${string}`;
export interface CatalogItemColumn {
  readonly id: CatalogItemColumnId;
  readonly tableLabelKey: string;
  readonly editorLabelKey: string;
  readonly errorPath: string;
  readonly required: boolean;
  readonly maxLength?: number;
  readonly inputType?: "text" | "date";
  readonly inputMode?: "numeric" | "decimal";
  readonly field?: CatalogFieldDraft;
  /** Its values are numbers: the table aligns it to the right (A, 2026-11-02). */
  readonly numeric?: boolean;
}

// The table and the complete editor describe the same option with the same columns, the text and the code apart (UD3).
export function catalogItemColumns(valueType: CatalogValueType, culture: FormCulture, fields: readonly CatalogFieldDraft[] = []): readonly CatalogItemColumn[] {
  return [
    { id: "text", tableLabelKey: "catalogs.items.text", editorLabelKey: "catalogs.items.text", errorPath: "text." + culture, required: true, maxLength: 30 },
    { id: "code", tableLabelKey: "catalogs.items.code", editorLabelKey: "catalogs.items.code", errorPath: "code", required: true, maxLength: 80 },
    ...fields.filter(field => field.isActive).map((field): CatalogItemColumn => ({ id: `field:${field.id ?? field.localId}`, tableLabelKey: "", editorLabelKey: "", errorPath: "fields." + (field.id ?? field.localId), required: field.required, field, numeric: isNumericType(field.type) })),
    ...(valueType === "Text" ? [] : [{ id: "value" as const, tableLabelKey: "catalogs.items.value", editorLabelKey: "catalogs.valueType.valueLabel", errorPath: "value", required: true, maxLength: 64,
      inputType: valueType === "Date" ? "date" as const : "text" as const, inputMode: valueType === "Date" ? undefined : valueType === "Integer" ? "numeric" as const : "decimal" as const, numeric: isNumericType(valueType) }]),
    { id: "detail", tableLabelKey: "catalogs.items.detail", editorLabelKey: "catalogs.items.detail", errorPath: "detail." + culture, required: false, maxLength: 300 },
    { id: "isActive", tableLabelKey: "catalogs.columns.state", editorLabelKey: "catalogs.items.active", errorPath: "isActive", required: false },
  ];
}
