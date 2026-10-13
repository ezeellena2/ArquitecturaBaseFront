import type { CatalogItemMove, ManualCatalogBody, UpdateManualCatalogBody } from "./api/catalogs";
import type { CatalogDetail, CatalogItem } from "./api/catalogResponse";
import { catalogItemChanges, mergeCatalogItemPage, newCatalogItemEdits, stageCatalogItem, type CatalogItemEdits, type CatalogManualItemValue } from "./catalogItemEdits";

import { openCatalogFilters } from "./catalogFilterDraft";
import type { CatalogFiltersEditorValue } from "./components/CatalogFiltersEditor";

export interface CatalogDraft {
  readonly isActive: boolean;
  readonly kind: "Manual" | "Filters";
  readonly filters: CatalogFiltersEditorValue | null;
  readonly id: string | null;
  readonly revision: number | null;
  readonly name: Readonly<Record<"es" | "en", string>>;
  readonly description: Readonly<Record<"es" | "en", string>>;
  readonly items: CatalogItemEdits;
  readonly moves: readonly CatalogItemMove[];
}
export function openCatalogDraft(catalog?: CatalogDetail, kind: CatalogDraft["kind"] = "Manual"): CatalogDraft {
  const origin = catalog?.kind ?? kind;
  return { isActive: catalog?.isActive ?? true, kind: origin, filters: origin === "Filters" ? openCatalogFilters(catalog?.filters ?? { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false }) : null, id: catalog?.id ?? null, revision: catalog?.revision ?? null, name: catalog ? { ...catalog.name } : { es: "", en: "" }, description: catalog ? { ...catalog.description } : { es: "", en: "" }, items: newCatalogItemEdits(), moves: [] };
}
export function catalogItemValue(item: CatalogItem): CatalogManualItemValue {
  // A persisted UUID is also a valid local correlation key. UI identity prefixes never enter a body.
  return { localId: item.id, itemId: item.id, label: { ...item.text }, detail: { ...item.detail }, code: item.code, position: item.position, isActive: item.isActive };
}
export const loadCatalogDraftItems = (draft: CatalogDraft, items: readonly CatalogItem[]): CatalogDraft => ({ ...draft, items: mergeCatalogItemPage(draft.items, items.map(catalogItemValue)) });
export const stageCatalogDraftItem = (draft: CatalogDraft, item: CatalogManualItemValue): CatalogDraft => ({ ...draft, items: stageCatalogItem(draft.items, item) });
export function catalogDraftBody(draft: CatalogDraft): ManualCatalogBody {
  return { name: { ...draft.name }, description: { ...draft.description }, items: catalogItemChanges(draft.items).map(item => ({ localId: item.localId, itemId: item.itemId, code: item.code, text: { ...item.label }, detail: { ...item.detail }, isActive: item.isActive })) };
}

export function stageCatalogDraftMove(draft: CatalogDraft, itemId: string, direction: CatalogItemMove["direction"]): CatalogDraft {
  if (!draft.id || !draft.items.originals["item:" + itemId]) return draft;
  return { ...draft, moves: [...draft.moves, { itemId, direction }] };
}
export function catalogDraftUpdateBody(draft: CatalogDraft): UpdateManualCatalogBody {
  if (!draft.id || draft.revision === null) throw new Error("An unsaved catalog cannot be updated.");
  return { ...catalogDraftBody(draft), expectedRevision: draft.revision, isActive: draft.isActive, ...(draft.moves.length ? { moves: draft.moves.map(move => ({ ...move })) } : {}) };
}
