import { formatDateOnly } from "./dateTime";
import { formatExactDecimal } from "./decimal";

export type TypedValueType = "integer" | "decimal" | "amount" | "date";
export type YesNoLabels = { readonly yes: string; readonly no: string };

/** The one screen format of a canonical typed value: grouped exact numbers and a numeric date; null when it is not canonical. */
export function formatTypedValue(type: TypedValueType, value: string, language: string): string | null {
  if (type === "date") return formatDateOnly(value, language);
  if (type === "integer" && value.includes(".")) return null;
  // H29: an amount of money always has two decimals: «1.500,50».
  if (type === "amount") return formatExactDecimal(withCents(value), language);
  return formatExactDecimal(value, language);
}

function withCents(value: string): string {
  const [integer, fraction = ""] = value.split(".");
  return fraction.length >= 2 ? value : `${integer}.${fraction.padEnd(2, "0")}`;
}

export function formatYesNo(value: string | boolean, labels: YesNoLabels): string | null {
  return value === true || value === "true" ? labels.yes : value === false || value === "false" ? labels.no : null;
}
