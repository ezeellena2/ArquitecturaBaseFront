import type { CatalogLookupResult } from "./api/catalogResponse";
import { formatCatalogFieldValue, type CatalogFieldDraft } from "./catalogFields";
import { withCatalogFieldValue, type CatalogManualItemValue } from "./catalogItemEdits";
import type { FormCulture } from "./model";

// «Completar con …» (CA1): before asking the registry, the tax id is checked here as the server checks it, so a wrong one never
// leaves the page; and the answer fills the option being edited, which the person can still change before «Listo».

const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export type TaxIdProblem = "required" | "length" | "checkDigit";

/** What is wrong with a CUIT: nothing written, not eleven digits (hyphens and spaces aside) or its check digit, by module 11. A
 *  check digit of 10 is never valid: the agency changes the prefix instead. */
export function taxIdProblem(value: string | null | undefined): TaxIdProblem | null {
  const digits = (value ?? "").replace(/[- ]/g, "");
  if (!digits) return "required";
  if (!/^\d{11}$/.test(digits)) return "length";
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const check = (11 - sum % 11) % 11;
  return check !== 10 && Number(digits[10]) === check ? null : "checkDigit";
}

/** Why the registry could not complete it, by the end of its stable code: the registry belongs to a module this feature does not
 *  name. Another code shows the message the server sent. */
export function catalogLookupFailure(code: string): "taxId" | "notFound" | "unavailable" | "other" {
  return /\.CuitInvalid$/.test(code) ? "taxId" : /\.PersonNotFound$/.test(code) ? "notFound" : /\.Unavailable$/.test(code) ? "unavailable" : "other";
}

/** The catalog fields of the answer whose option texts are still needed, by their source catalog. */
export function catalogLookupOptionIds(result: CatalogLookupResult, fields: readonly CatalogFieldDraft[]): ReadonlyMap<string, readonly string[]> {
  const bySource = new Map<string, string[]>();
  for (const value of result.fields) {
    const field = lookupField(fields, value.fieldId);
    if (field?.type !== "catalog" || !field.sourceCatalogId) continue;
    bySource.set(field.sourceCatalogId, [...bySource.get(field.sourceCatalogId) ?? [], value.value]);
  }
  return bySource;
}

/**
 * The option with what the registry answered: its text in the language being edited (`culture`, never copied to the other one)
 * and the value of each active saved field it knows, written in the draft's culture. A catalog field takes the id of the option
 * and, when it came, the texts of that option (`optionTexts`, by id), so it shows its name; a value without its field is dropped.
 */
export function withCatalogLookup(item: CatalogManualItemValue, result: CatalogLookupResult, fields: readonly CatalogFieldDraft[], culture: FormCulture,
  valueCulture: FormCulture, optionTexts: Readonly<Record<string, Readonly<Record<string, string>>>> = {}): CatalogManualItemValue {
  let next: CatalogManualItemValue = result.text ? { ...item, label: { ...item.label, [culture]: result.text } } : item;
  for (const value of result.fields) {
    const field = lookupField(fields, value.fieldId);
    if (!field?.id) continue;
    next = field.type === "catalog"
      ? withCatalogFieldValue(next, field.id, value.value, optionTexts[value.value.toLowerCase()])
      : withCatalogFieldValue(next, field.id, formatCatalogFieldValue(field, value.value, valueCulture) || null);
  }
  return next;
}

const lookupField = (fields: readonly CatalogFieldDraft[], fieldId: string) =>
  fields.find(field => field.isActive && field.id?.toLowerCase() === fieldId.toLowerCase());
