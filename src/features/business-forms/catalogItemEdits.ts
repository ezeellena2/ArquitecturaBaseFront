// Local editor values, not an HTTP write contract. Only loaded/touched identities are retained.
export interface CatalogManualItemValue {
  readonly localId: string;
  readonly itemId: string | null;
  readonly label: Readonly<Record<string, string | null>>;
  readonly detail: Readonly<Record<string, string | null>>;
  readonly code: string;
  readonly isActive: boolean;
  readonly position: number | null;
}
export interface CatalogItemEdits {
  readonly originals: Readonly<Record<string, CatalogManualItemValue>>;
  readonly changes: Readonly<Record<string, CatalogManualItemValue>>;
}
const identity = (item: CatalogManualItemValue) => item.itemId ? "item:" + item.itemId : "new:" + item.localId;
const copy = (item: CatalogManualItemValue): CatalogManualItemValue => ({ ...item, label: { ...item.label }, detail: { ...item.detail } });
const sameTexts = (first: Readonly<Record<string, string | null>>, second: Readonly<Record<string, string | null>>) => {
  const keys = Object.keys(first);
  return keys.length === Object.keys(second).length && keys.every(key => Object.hasOwn(second, key) && first[key] === second[key]);
};
const sameValue = (first: CatalogManualItemValue, second: CatalogManualItemValue) => first.itemId === second.itemId && first.code === second.code
  && first.isActive === second.isActive && first.position === second.position && sameTexts(first.label, second.label) && sameTexts(first.detail, second.detail);

export const newCatalogItemEdits = (): CatalogItemEdits => ({ originals: {}, changes: {} });

export function mergeCatalogItemPage(state: CatalogItemEdits, items: readonly CatalogManualItemValue[]): CatalogItemEdits {
  const originals = { ...state.originals };
  for (const item of items) {
    const key = identity(item);
    if (!Object.hasOwn(originals, key)) originals[key] = copy(item);
  }
  return { originals, changes: state.changes };
}

export function stageCatalogItem(state: CatalogItemEdits, item: CatalogManualItemValue): CatalogItemEdits {
  const key = identity(item);
  const original = state.originals[key];
  if (item.itemId !== null && !original) return state;
  const confirmed = { ...item, position: original?.position ?? null };
  const changes = { ...state.changes };
  if (original && sameValue(original, confirmed)) delete changes[key];
  else changes[key] = copy(confirmed);
  return { originals: state.originals, changes };
}

export const catalogItemChanges = (state: CatalogItemEdits): readonly CatalogManualItemValue[] => Object.values(state.changes).map(copy);

export function currentCatalogItem(state: CatalogItemEdits, item: CatalogManualItemValue): CatalogManualItemValue {
  return copy(state.changes[identity(item)] ?? state.originals[identity(item)] ?? item);
}
