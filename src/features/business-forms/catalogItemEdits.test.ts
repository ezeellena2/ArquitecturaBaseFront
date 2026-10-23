import { describe, expect, it } from "vitest";
import { catalogItemChanges, mergeCatalogItemPage, newCatalogItemEdits, stageCatalogItem, withCatalogFieldValue, type CatalogManualItemValue } from "./catalogItemEdits";

const first: CatalogManualItemValue = { value: null, localId: "first", itemId: "saved-first", label: { es: "Pérez Hnos.", en: "" }, detail: { es: "Av. Colón 1234", en: null }, code: "C-001", isActive: true, position: 1 };
const second: CatalogManualItemValue = { ...first, localId: "second", itemId: "saved-second", label: { es: "Ferretería Sur", en: "South hardware" }, code: "C-002", position: 2 };

describe("Manual catalog edits across partial pages", () => {
  it("keeps an edit from the first page when another page is loaded", () => {
    let state = mergeCatalogItemPage(newCatalogItemEdits(), [first]);
    const edited = { ...first, label: { ...first.label, es: "Pérez Hermanos" } };
    state = stageCatalogItem(state, edited);
    state = mergeCatalogItemPage(state, [second]);
    expect(catalogItemChanges(state)).toEqual([edited]);
    expect(first.label.es).toBe("Pérez Hnos.");
  });
  it("supplies only touched identities, including new options, rather than replacing a page", () => {
    let state = mergeCatalogItemPage(newCatalogItemEdits(), [first, second]);
    const edited = { ...second, isActive: false };
    const added = { ...first, localId: "new-item", itemId: null, code: "C-003", position: 3 };
    state = stageCatalogItem(stageCatalogItem(state, edited), added);
    expect(catalogItemChanges(state)).toEqual([edited, { ...added, position: null }]);
    expect(catalogItemChanges(state).some(item => item.itemId === first.itemId)).toBe(false);
  });
  it("removes a restored value from the pending set without deactivating other items", () => {
    let state = mergeCatalogItemPage(newCatalogItemEdits(), [first, second]);
    state = stageCatalogItem(state, { ...first, code: "C-099", isActive: false });
    state = stageCatalogItem(state, first);
    expect(catalogItemChanges(state)).toEqual([]);
  });
  it("does not adopt a refresh as a new baseline for a previously loaded item", () => {
    let state = mergeCatalogItemPage(newCatalogItemEdits(), [first]);
    const edited = { ...first, code: "LOCAL" };
    state = stageCatalogItem(state, edited);
    state = mergeCatalogItemPage(state, [{ ...first, code: "REMOTE" }]);
    expect(catalogItemChanges(state)).toEqual([edited]);
    state = stageCatalogItem(state, first);
    expect(catalogItemChanges(state)).toEqual([]);
  });
  it("does not stage a persisted identity that was never loaded", () => {
    const state = newCatalogItemEdits();
    expect(catalogItemChanges(stageCatalogItem(state, first))).toEqual([]);
  });
  it("owns copies of input texts and does not change after an external mutation", () => {
    const source = { ...first, code: "LOCAL", label: { ...first.label }, detail: { ...first.detail } };
    const state = stageCatalogItem(mergeCatalogItemPage(newCatalogItemEdits(), [first]), source);
    source.label.es = "Changed outside the editor";
    source.detail.es = "Changed outside the editor";
    expect(catalogItemChanges(state)).toEqual([{ ...first, code: "LOCAL" }]);
  });
  it("drops the source text when a field value is cleared", () => {
    const item = { ...first, fields: { zone: "zone-centro", tax: "20-1" }, fieldTexts: { zone: { es: "Centro" }, other: { es: "Otro" } } };
    const cleared = withCatalogFieldValue(item, "zone", null);
    expect(cleared).toEqual({ ...first, fields: { zone: null, tax: "20-1" }, fieldTexts: { other: { es: "Otro" } } });
    expect(withCatalogFieldValue(cleared, "zone", "zone-norte", { es: "Norte", en: "North" })).toEqual({ ...first, fields: { zone: "zone-norte", tax: "20-1" }, fieldTexts: { zone: { es: "Norte", en: "North" }, other: { es: "Otro" } } });
    expect(withCatalogFieldValue(item, "tax", "20-2")).toEqual({ ...item, fields: { zone: "zone-centro", tax: "20-2" } });
    expect(item.fieldTexts.zone).toEqual({ es: "Centro" });
  });
  it("does not stage unchanged text maps when their property order differs", () => {
    const state = mergeCatalogItemPage(newCatalogItemEdits(), [first]);
    const reordered = { ...first, label: { en: "", es: "Pérez Hnos." }, detail: { en: null, es: "Av. Colón 1234" } };
    expect(catalogItemChanges(stageCatalogItem(state, reordered))).toEqual([]);
  });
});
