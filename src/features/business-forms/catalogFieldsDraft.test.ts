import { expect, it } from "vitest";
import { catalogDraftUpdateBody, catalogItemFieldIssues, loadCatalogDraftItems, openCatalogDraft, stageCatalogDraftItem } from "./catalogDraft";
import { catalogItemChanges, mergeCatalogItemPage, newCatalogItemEdits, stageCatalogItem } from "./catalogItemEdits";
import type { CatalogDetail, CatalogField } from "./api/catalogResponse";

const id = "01990000-0000-7000-8000-000000000010";
const fieldId = "01990000-0000-7000-8000-000000000011";
const field: CatalogField = { id: fieldId, key: "amount", name: { es: "Importe" }, type: "decimal", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 1, isActive: true, hasValues: true, usedBy: [] };
const catalog: CatalogDetail = { id, key: id.replaceAll("-", ""), name: { es: "Proveedores", en: "Suppliers" }, description: { es: "Activos", en: "Active" }, kind: "Manual", revision: 2, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null, filters: null, proposal: null, valueType: "Text", fields: [field], presentation: { title: ["text"], description: [fieldId] }, presentationCheck: { titleTooLongCount: 0, examples: [] } };
const item = { id: "01990000-0000-7000-8000-000000000012", code: "NORTH", text: { es: "Norte" }, detail: {}, value: null, position: 1, isActive: true, fields: { [fieldId]: "1500.5" }, fieldTexts: {} };

it("loads fields in the catalog culture and writes exact canonical deltas with the complete definition list", () => {
  const loaded = loadCatalogDraftItems(openCatalogDraft(catalog), [item]);
  const original = Object.values(loaded.items.originals)[0]!;
  expect(original.fields?.[fieldId]).toBe("1.500,5");
  const changed = stageCatalogDraftItem(loaded, { ...original, fields: { [fieldId]: "2.500,75" } });
  const body = catalogDraftUpdateBody(changed);
  expect(body.items[0]?.fields).toEqual({ [fieldId]: "2500.75" });
  expect(body.fields?.[0]).toMatchObject({ id: fieldId, key: "amount", type: "decimal" });
  expect(body.fields?.[0]).not.toHaveProperty("hasValues");
  expect(body.presentation).toEqual(catalog.presentation);
});

it("owns staged field maps and compares their contents without depending on property order", () => {
  const original = { localId: "row", itemId: item.id, label: item.text, detail: {}, code: item.code, value: null, position: 1, isActive: true, fields: { first: "1", second: "2" } };
  const loaded = mergeCatalogItemPage(newCatalogItemEdits(), [original]);
  expect(catalogItemChanges(stageCatalogItem(loaded, { ...original, fields: { second: "2", first: "1" } }))).toEqual([]);
  const fields = { first: "changed", second: "2" };
  const changed = stageCatalogItem(loaded, { ...original, fields });
  fields.first = "outside";
  expect(catalogItemChanges(changed)[0]?.fields).toEqual({ first: "changed", second: "2" });
});

it("requires a field value only on active options", () => {
  const draft = loadCatalogDraftItems(openCatalogDraft({ ...catalog, fields: [{ ...field, required: true }] }), [{ ...item, isActive: false, fields: {} }]);
  const original = Object.values(draft.items.originals)[0]!;
  expect(catalogItemFieldIssues(draft, original)).toEqual([]);
  expect(catalogItemFieldIssues(draft, { ...original, isActive: true })).toEqual([{ fieldId, reason: "required" }]);
  expect(catalogItemFieldIssues(draft, { ...original, fields: { [fieldId]: "abc" } })).toEqual([{ fieldId, reason: "invalid" }]);
  const cleared = stageCatalogDraftItem(draft, { ...original, label: { es: "Norte nuevo" }, fields: { [fieldId]: "" } });
  expect(catalogDraftUpdateBody(cleared).items[0]).toMatchObject({ isActive: false, fields: { [fieldId]: null } });
});

it("opens canonical decimal bounds in the catalog culture without changing their magnitude", () => {
  const draft = openCatalogDraft({ ...catalog, fields: [{ ...field, min: "1.234", max: "10.123" }] });
  expect(draft.fields[0]).toMatchObject({ min: "1,234", max: "10,123" });
  expect(catalogDraftUpdateBody(draft).fields?.[0]).toMatchObject({ min: "1.234", max: "10.123" });
});
