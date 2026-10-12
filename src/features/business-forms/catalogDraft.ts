import type { ManualCatalogBody } from "./api/catalogs";
import type { CatalogDetail, CatalogItem } from "./api/catalogResponse";
import { catalogItemChanges, mergeCatalogItemPage, newCatalogItemEdits, stageCatalogItem, type CatalogItemEdits, type CatalogManualItemValue } from "./catalogItemEdits";

export interface CatalogDraft {
  readonly id: string | null;
  readonly revision: number | null;
  readonly name: Readonly<Record<"es" | "en", string>>;
  readonly description: Readonly<Record<"es" | "en", string>>;
  readonly items: CatalogItemEdits;
}
export function openCatalogDraft(catalog?: CatalogDetail): CatalogDraft {
  return { id: catalog?.id ?? null, revision: catalog?.revision ?? null, name: catalog ? { ...catalog.name } : { es: "", en: "" }, description: catalog ? { ...catalog.description } : { es: "", en: "" }, items: newCatalogItemEdits() };
}
export function catalogItemValue(item: CatalogItem): CatalogManualItemValue {
  // A persisted UUID is also a valid local correlation key. UI identity prefixes never enter a body.
  return { localId: item.id, itemId: item.id, label: { ...item.text }, detail: { ...item.detail }, code: item.code, position: item.position, isActive: item.isActive };
}
export const loadCatalogDraftItems = (draft: CatalogDraft, items: readonly CatalogItem[]): CatalogDraft => ({ ...draft, items: mergeCatalogItemPage(draft.items, items.map(catalogItemValue)) });
export const stageCatalogDraftItem = (draft: CatalogDraft, item: CatalogManualItemValue): CatalogDraft => ({ ...draft, items: stageCatalogItem(draft.items, item) });
export function catalogDraftBody(draft: CatalogDraft): ManualCatalogBody {
  return { name: { ...draft.name }, description: { ...draft.description }, items: catalogItemChanges(draft.items).map(item => ({ localId: item.localId, itemId: item.itemId, code: item.code, text: { ...item.label }, detail: { ...item.detail }, position: item.position, isActive: item.isActive })) };
}
