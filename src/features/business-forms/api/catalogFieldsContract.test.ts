// Synthetic boundary cases; only the exported HTTP cohorts qualify backend responses.
import { describe, expect, it } from "vitest";
import { readCatalog, readCatalogItems, readCatalogSave, UnsupportedCatalogResponse } from "./catalogResponse";

const id = "01990000-0000-7000-8000-000000000001";
const fieldId = "01990000-0000-7000-8000-000000000002";
const itemId = "01990000-0000-7000-8000-000000000003";
const field = { id: fieldId, key: "tax_id", name: { es: "CUIT", en: "Tax ID" }, type: "text", sourceCatalogId: null, required: true, unique: true, min: null, max: null, maxLength: 30, role: "data", position: 1, isActive: true, hasValues: true, usedBy: [] };
const catalog = { id, key: id.replaceAll("-", ""), name: { es: "Proveedores", en: "Suppliers" }, description: { es: "Proveedores activos", en: "Active suppliers" }, kind: "Manual", valueType: "Text", revision: 2, isActive: true, itemsCount: 1, usageCount: 0, unavailableReasonCode: null, filters: null, proposal: null, fields: [field], presentation: { title: ["text"], description: [fieldId] }, presentationCheck: { titleTooLongCount: 0, examples: [] } };
const item = { id: itemId, code: "NORTH", text: { es: "Proveedor Norte" }, detail: {}, value: null, position: 1, isActive: true, fields: { [fieldId]: "30-71234567-8" }, fieldTexts: {} };

describe("catalog extra field boundary", () => {
  it("reads field definitions, usage and presentation without dropping their identities", () => {
    const result = readCatalog(catalog);
    expect(result.fields?.[0]).toEqual(field);
    expect(result.presentation?.description).toEqual([fieldId]);
    expect(result.presentationCheck?.titleTooLongCount).toBe(0);
  });
  it("rejects missing current fields, unknown field properties and invalid metadata", () => {
    const { fields: _fields, ...incomplete } = catalog;
    for (const value of [incomplete, { ...catalog, fields: [{ ...field, hidden: "private" }] }, { ...catalog, fields: [{ ...field, type: "money" }] }, { ...catalog, fields: [{ ...field, role: "admin" }] }, { ...catalog, fields: [field, field] }, { ...catalog, fields: [{ ...field, key: "Tax ID" }] }]) expect(() => readCatalog(value)).toThrow(UnsupportedCatalogResponse);
  });
  it("reads canonical item maps and source labels while rejecting malformed keys or extra properties", () => {
    const page = { items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false };
    expect(readCatalogItems(page).items[0]?.fields).toEqual(item.fields);
    expect(() => readCatalogItems({ ...page, items: [{ ...item, fields: { invalid: "value" } }] })).toThrow(UnsupportedCatalogResponse);
    expect(() => readCatalogItems({ ...page, items: [{ ...item, privateValue: "secret" }] })).toThrow(UnsupportedCatalogResponse);
  });
  it("binds exactly the field identities from the submitted save", () => {
    const receipt = { catalog, itemIdentityMap: {}, fieldIdentityMap: { "new-field": fieldId } };
    expect(readCatalogSave(receipt, [], id, 1, ["new-field"]).fieldIdentityMap).toEqual({ "new-field": fieldId });
    expect(() => readCatalogSave(receipt, [], id, 1, ["different-field"])).toThrow(UnsupportedCatalogResponse);
    expect(() => readCatalogSave({ ...receipt, fieldIdentityMap: { "new-field": itemId } }, [], id, 1, ["new-field"])).toThrow(UnsupportedCatalogResponse);
  });
  it("preserves a reference from this catalog's own WhatsApp presentation", () => {
    const usedBy = [{ definitionId: null, formName: "Proveedores", question: null, stage: "Catalog" }];
    expect(readCatalog({ ...catalog, fields: [{ ...field, usedBy }] }).fields?.[0]?.usedBy).toEqual(usedBy);
  });
});

it("retains source option labels up to the existing option text limit", () => {
  const fields = { [fieldId]: itemId };
  const fieldTexts = { [fieldId]: { es: "A".repeat(200) } };
  const page = { items: [{ ...item, fields, fieldTexts }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false };
  expect(readCatalogItems(page).items[0]?.fieldTexts).toEqual(fieldTexts);
});
