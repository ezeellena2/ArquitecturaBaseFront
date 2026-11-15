import { formatTypedValue } from "@/shared/lib/typedValue";

/// What an external action leaves in a response (RE1-A): «Emitir comprobante en ARCA» with its voucher, code and expiry.
export type ResponseResultKind = "text" | "date" | "number" | "amount";

// A result's value as the person reads it: dates and numbers in the shared format of the language, text as it came. Without a value,
// null: the zone and the sheet show «—».
export function responseResultText(kind: ResponseResultKind, value: string | null | undefined, language: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (kind === "text") return value;
  return formatTypedValue(kind === "date" ? "date" : kind === "amount" ? "amount" : "decimal", value, language) ?? value;
}

// The sheet's column of a result datum, after the questions: its label says which action left it when two actions share a label.
export function responseResultColumnLabel(column: { readonly label: string; readonly sourceName: string }, columns: readonly { readonly label: string; readonly sourceName: string }[]): string {
  return columns.filter(other => other.label === column.label).length > 1 ? `${column.label} · ${column.sourceName}` : column.label;
}
