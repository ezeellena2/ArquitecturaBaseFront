import { formatDateOnly } from "./dateTime";
import { formatExactDecimal } from "./decimal";

export type TypedValueType = "integer" | "decimal" | "date";
export type YesNoLabels = { readonly yes: string; readonly no: string };

/** The one screen format of a canonical typed value: grouped exact numbers and a numeric date; null when it is not canonical. */
export function formatTypedValue(type: TypedValueType, value: string, language: string): string | null {
  if (type === "date") return formatDateOnly(value, language, "numeric");
  if (type === "integer" && value.includes(".")) return null;
  return formatExactDecimal(value, language.startsWith("es") ? "es-AR" : "en-US");
}

export function formatYesNo(value: string | boolean, labels: YesNoLabels): string | null {
  return value === true || value === "true" ? labels.yes : value === false || value === "false" ? labels.no : null;
}
