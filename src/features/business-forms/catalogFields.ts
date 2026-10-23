import type { CatalogField } from "./api/catalogResponse";
import { formatCatalogValue, parseCatalogValue, type CatalogValueType } from "./catalogValues";
import type { FormCulture } from "./model";

export type CatalogFieldType = CatalogField["type"];
export interface CatalogFieldDraft extends Omit<CatalogField, "id"> { readonly id: string | null; readonly localId: string }
export type CatalogFieldBody = Omit<CatalogFieldDraft, "hasValues" | "usedBy">;
export type CatalogFieldValueResult = { readonly valid: true; readonly value: string | null } | { readonly valid: false; readonly reason: "required" | "invalid" | "range" | "length" };

export const newCatalogField = (localId: string, position: number): CatalogFieldDraft => ({ localId, id: null, key: "", name: { es: "" }, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position, isActive: true, hasValues: false, usedBy: [] });
export const openCatalogField = (field: CatalogField, culture: FormCulture = "es"): CatalogFieldDraft => ({ ...field, localId: field.id, name: { ...field.name }, min: field.min === null ? null : formatCatalogFieldValue(field, field.min, culture), max: field.max === null ? null : formatCatalogFieldValue(field, field.max, culture), usedBy: field.usedBy.map(use => ({ ...use })) });
function valueType(type: CatalogFieldType): CatalogValueType | null {
  return type === "integer" ? "Integer" : type === "decimal" ? "Decimal" : type === "date" ? "Date" : null;
}

function compareDecimal(left: string, right: string): number {
  const [wholeA, fractionA = ""] = left.split(".");
  const [wholeB, fractionB = ""] = right.split(".");
  const scale = Math.max(fractionA.length, fractionB.length);
  const a = BigInt(wholeA! + fractionA.padEnd(scale, "0"));
  const b = BigInt(wholeB! + fractionB.padEnd(scale, "0"));
  return a < b ? -1 : a > b ? 1 : 0;
}

export function parseCatalogFieldValue(field: Pick<CatalogFieldDraft, "type" | "required" | "min" | "max" | "maxLength">, input: string | null | undefined, culture: FormCulture): CatalogFieldValueResult {
  const text = input?.trim() ?? "";
  if (!text) return field.required ? { valid: false, reason: "required" } : { valid: true, value: null };
  const type = valueType(field.type);
  if (type) {
    const result = parseCatalogValue(type, text, culture);
    if (!result.valid) return result;
    const compare = field.type === "date" ? (a: string, b: string) => a.localeCompare(b) : compareDecimal;
    for (const [input, lower] of [[field.min, true], [field.max, false]] as const) {
      if (input === null || !input.trim()) continue;
      const bound = parseCatalogValue(type, input, culture);
      if (!bound.valid) return { valid: false, reason: "invalid" };
      if (lower ? compare(result.value!, bound.value!) < 0 : compare(result.value!, bound.value!) > 0) return { valid: false, reason: "range" };
    }
    return result;
  }
  if (field.type === "boolean" && text !== "true" && text !== "false" || field.type === "catalog" && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(text))) return { valid: false, reason: "invalid" };
  if (field.type === "text" && text.length > (field.maxLength ?? 300)) return { valid: false, reason: "length" };
  return { valid: true, value: field.type === "catalog" ? text.toLowerCase() : text };
}

export function formatCatalogFieldValue(field: Pick<CatalogFieldDraft, "type">, value: string | null | undefined, culture: FormCulture): string {
  if (value === null || value === undefined) return "";
  const type = valueType(field.type);
  return type && type !== "Date" ? formatCatalogValue(type, value, culture) : value;
}

export function catalogFieldsBody(fields: readonly CatalogFieldDraft[], culture: FormCulture = "es"): readonly CatalogFieldBody[] {
  return fields.map(({ hasValues: _hasValues, usedBy: _usedBy, ...field }, index) => {
    const type = valueType(field.type);
    const bound = (input: string | null) => {
      if (!input?.trim()) return null;
      const result = type ? parseCatalogValue(type, input, culture) : null;
      return result?.valid ? result.value : input;
    };
    return { ...field, name: { ...field.name }, min: bound(field.min), max: bound(field.max), position: index + 1 };
  });
}
