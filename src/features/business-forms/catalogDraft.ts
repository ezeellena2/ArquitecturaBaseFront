import { formatCatalogValue, parseCatalogValue, type CatalogValueType } from "./catalogValues";
import type { FormCulture } from "./model";
import type { CatalogItemMove, CreateManualCatalogBody, UpdateManualCatalogBody } from "./api/catalogs";
import type { CatalogDetail, CatalogItem } from "./api/catalogResponse";
import { catalogItemChanges, mergeCatalogItemPage, newCatalogItemEdits, stageCatalogItem, type CatalogItemEdits, type CatalogManualItemValue } from "./catalogItemEdits";

import { openCatalogFilters } from "./catalogFilterDraft";
import type { CatalogFiltersEditorValue } from "./components/CatalogFiltersEditor";
import { catalogFieldsBody, formatCatalogFieldValue, openCatalogField, parseCatalogFieldValue, type CatalogFieldDraft, type CatalogFieldValueResult } from "./catalogFields";
import type { CatalogPresentation } from "./api/catalogResponse";

export interface CatalogDraft {
  readonly valueType: CatalogValueType;
  readonly culture: FormCulture;
  readonly proposal: CatalogDetail["proposal"];
  readonly isActive: boolean;
  readonly kind: "Manual" | "Filters";
  readonly filters: CatalogFiltersEditorValue | null;
  readonly id: string | null;
  readonly revision: number | null;
  readonly name: Readonly<Record<"es" | "en", string>>;
  readonly description: Readonly<Record<"es" | "en", string>>;
  readonly items: CatalogItemEdits;
  readonly moves: readonly CatalogItemMove[];
  readonly sortAlphabetically: boolean;
  readonly fields: readonly CatalogFieldDraft[];
  // The confirmed definition: loaded values are formatted with it and an unedited value is checked against it.
  readonly savedFields: readonly CatalogFieldDraft[];
  readonly presentation: CatalogPresentation | null;
  readonly confirmFieldRemovals: readonly string[];
}
export function openCatalogDraft(catalog?: CatalogDetail, kind: CatalogDraft["kind"] = "Manual", valueType: CatalogValueType = "Text", culture: FormCulture = "es"): CatalogDraft {
  const origin = catalog?.kind ?? kind;
  const fields = catalog?.fields?.map(field => openCatalogField(field, culture)) ?? [];
  return { valueType: catalog?.valueType ?? (origin === "Filters" ? "Text" : valueType), culture, proposal: catalog?.proposal ?? null, isActive: catalog?.isActive ?? true, kind: origin, filters: origin === "Filters" ? openCatalogFilters(catalog?.filters ?? { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false }) : null, id: catalog?.id ?? null, revision: catalog?.revision ?? null, name: { es: catalog?.name.es ?? "", en: catalog?.name.en ?? "" }, description: { es: catalog?.description.es ?? "", en: catalog?.description.en ?? "" }, items: newCatalogItemEdits(), moves: [], sortAlphabetically: false, fields, savedFields: fields, presentation: catalog?.presentation ? { title: [...catalog.presentation.title], description: [...catalog.presentation.description] } : null, confirmFieldRemovals: [] };
}
export function catalogItemValue(item: CatalogItem, valueType: CatalogValueType, culture: FormCulture, fields: readonly CatalogFieldDraft[] = []): CatalogManualItemValue {
  // A persisted UUID is also a valid local correlation key. UI identity prefixes never enter a body.
  return { value: valueType === "Text" ? null : valueType === "Date" ? item.value : formatCatalogValue(valueType, item.value, culture), localId: item.id, itemId: item.id, label: { ...item.text }, detail: { ...item.detail }, code: item.code, position: item.position, isActive: item.isActive, fields: Object.fromEntries(Object.entries(item.fields).map(([id, value]) => { const field = fields.find(field => field.id === id); return [id, field ? formatCatalogFieldValue(field, value, culture) || null : value]; })), fieldTexts: Object.fromEntries(Object.entries(item.fieldTexts).map(([id, text]) => [id, { ...text }])) };
}
export const loadCatalogDraftItems = (draft: CatalogDraft, items: readonly CatalogItem[]): CatalogDraft => ({ ...draft, items: mergeCatalogItemPage(draft.items, items.map(item => catalogItemValue(item, draft.valueType, draft.culture, draft.savedFields))) });
export const stageCatalogDraftItem = (draft: CatalogDraft, item: CatalogManualItemValue): CatalogDraft => ({ ...draft, items: stageCatalogItem(draft.items, item) });
function canonicalItemValue(draft: CatalogDraft, item: CatalogManualItemValue): string | null {
  const parsed = parseCatalogValue(draft.valueType, item.value, draft.culture);
  if (!parsed.valid) throw new Error("Invalid catalog item value.");
  return parsed.value;
}
// The server requires a field value only on active options.
export const catalogItemFieldRule = (field: CatalogFieldDraft, item: Pick<CatalogManualItemValue, "isActive">): CatalogFieldDraft => ({ ...field, required: field.required && item.isActive });
export interface CatalogItemFieldIssue { readonly fieldId: string; readonly reason: Extract<CatalogFieldValueResult, { valid: false }>["reason"] }
/** The field values the author edited: all of a new option's, or those that differ from the loaded value. */
export function editedFieldIds(draft: Pick<CatalogDraft, "items">, item: CatalogManualItemValue): readonly string[] {
  const original = item.itemId === null ? undefined : draft.items.originals["item:" + item.itemId];
  return Object.keys(item.fields ?? {}).filter(id => !original || (item.fields?.[id] ?? null) !== (original.fields?.[id] ?? null));
}
// An edited value, and any value of a new option, follows the draft definition. An unedited one keeps the saved type,
// range and length, and is required only when both definitions require it: the server reviews a type or required change
// over all the stored values and answers for them.
export function catalogItemFieldIssues(draft: Pick<CatalogDraft, "fields" | "savedFields" | "items" | "culture">, item: CatalogManualItemValue): readonly CatalogItemFieldIssue[] {
  const edited = editedFieldIds(draft, item);
  return draft.fields.flatMap(field => {
    if (!field.id || !field.isActive) return [];
    const saved = item.itemId === null || edited.includes(field.id) ? undefined : draft.savedFields.find(candidate => candidate.id === field.id);
    const definition = saved ? { ...saved, required: saved.required && field.required } : field;
    const result = parseCatalogFieldValue(catalogItemFieldRule(definition, item), item.fields?.[field.id], draft.culture);
    return result.valid ? [] : [{ fieldId: field.id, reason: result.reason }];
  });
}
// items[i].fields is a delta: an absent key keeps the stored value, so only edited values travel.
function editedFieldValues(draft: CatalogDraft, item: CatalogManualItemValue): Readonly<Record<string, string | null>> {
  return Object.fromEntries(editedFieldIds(draft, item).flatMap(id => {
    const field = draft.fields.find(field => field.id === id && field.isActive);
    if (!field) return [];
    const parsed = parseCatalogFieldValue(catalogItemFieldRule(field, item), item.fields?.[id], draft.culture);
    if (!parsed.valid) throw new Error("Invalid catalog field value.");
    return [[id, parsed.value]];
  }));
}
export function catalogDraftBody(draft: CatalogDraft): CreateManualCatalogBody {
  return { valueType: draft.valueType, name: { ...draft.name }, description: { ...draft.description }, fields: catalogFieldsBody(draft.fields, draft.culture), presentation: draft.presentation ? { title: [...draft.presentation.title], description: [...draft.presentation.description] } : null, items: catalogItemChanges(draft.items).map(item => {
    const fields = editedFieldValues(draft, item);
    return { value: canonicalItemValue(draft, item), localId: item.localId, itemId: item.itemId, code: item.code, text: { ...item.label }, detail: { ...item.detail }, isActive: item.isActive, ...(Object.keys(fields).length ? { fields } : {}) };
  }) };
}

export function stageCatalogDraftMove(draft: CatalogDraft, itemId: string, direction: CatalogItemMove["direction"]): CatalogDraft {
  if (!draft.id || draft.sortAlphabetically || !draft.items.originals["item:" + itemId]) return draft;
  return { ...draft, moves: [...draft.moves, { itemId, direction }] };
}
export function catalogDraftUpdateBody(draft: CatalogDraft): UpdateManualCatalogBody {
  if (!draft.id || draft.revision === null) throw new Error("An unsaved catalog cannot be updated.");
  const body = catalogDraftBody(draft);
  return { name: body.name, description: body.description, fields: body.fields, presentation: body.presentation, confirmFieldRemovals: [...draft.confirmFieldRemovals], items: body.items, expectedRevision: draft.revision, isActive: draft.isActive, ...(draft.sortAlphabetically ? { sortAlphabetically: true } : {}), ...(!draft.sortAlphabetically && draft.moves.length ? { moves: draft.moves.map(move => ({ ...move })) } : {}) };
}
