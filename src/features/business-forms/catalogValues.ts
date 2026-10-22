import { formatExactDecimal } from "@/shared/lib/decimal";
import { formatDateOnly } from "@/shared/lib/dateTime";

export const catalogValueTypes = ["Text", "Integer", "Decimal", "Date"] as const;
export type CatalogValueType = typeof catalogValueTypes[number];
export type ParsedCatalogValue = { valid: true; value: string | null } | { valid: false; reason: "required" | "invalid" };
export const isCatalogValueType = (value: string | null): value is CatalogValueType => catalogValueTypes.some(type => type === value);

function canonicalNumber(input: string, integerOnly: boolean): string | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(input)) return null;
  const negative = input.startsWith("-");
  const [wholeInput, fractionInput = ""] = input.replace(/^-/, "").split(".");
  const whole = wholeInput.replace(/^0+(?=\d)/, "");
  const fraction = fractionInput.replace(/0+$/, "");
  if (integerOnly && (fractionInput.length > 0 || whole.length > 18)) return null;
  // A decimal is an exact 96-bit coefficient and a scale of at most 28; never round through Number.
  if (!integerOnly && (fraction.length > 28 || BigInt(whole + fraction) > 79228162514264337593543950335n)) return null;
  const value = whole + (fraction ? "." + fraction : "");
  return negative && value !== "0" ? "-" + value : value;
}

function localizedNumber(input: string, culture: string): string {
  if (culture.startsWith("es")) {
    if (/^-?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(input)) return input.replaceAll(".", "").replace(",", ".");
    return input.includes(",") ? input.replace(",", ".") : input;
  }
  return /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(input) ? input.replaceAll(",", "") : input;
}

export function parseCatalogValue(type: CatalogValueType, input: string | null, culture: string): ParsedCatalogValue {
  const text = input?.trim() ?? "";
  if (type === "Text") return text ? { valid: false, reason: "invalid" } : { valid: true, value: null };
  if (!text) return { valid: false, reason: "required" };
  if (text.length > 64) return { valid: false, reason: "invalid" };
  let value: string | null;
  if (type === "Date") {
    const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    const parts = local ? culture.startsWith("es") ? [local[3], local[2], local[1]] : [local[3], local[1], local[2]] : null;
    const date = parts ? parts.map(part => part.padStart(2, "0")).join("-") : text;
    value = formatDateOnly(date, culture) ? date : null;
  } else value = canonicalNumber(localizedNumber(text, culture), type === "Integer");
  return value === null ? { valid: false, reason: "invalid" } : { valid: true, value };
}

export function isCanonicalCatalogValue(type: CatalogValueType, value: string | null): boolean {
  if (type === "Text") return value === null;
  if (value === null || value.length > 64) return false;
  if (type === "Date") return /^\d{4}-\d{2}-\d{2}$/.test(value) && formatDateOnly(value, "en") !== null;
  return canonicalNumber(value, type === "Integer") === value;
}

export function formatCatalogValue(type: CatalogValueType, value: string | null, culture: string): string {
  if (value === null) return "";
  if (type === "Text") return value;
  return (type === "Date" ? formatDateOnly(value, culture) : formatExactDecimal(value, culture.startsWith("es") ? "es-AR" : culture)) ?? value;
}
