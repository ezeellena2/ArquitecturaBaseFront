import { describe, expect, it } from "vitest";
import { newCatalogField, type CatalogFieldDraft } from "./catalogFields";
import type { CatalogManualItemValue } from "./catalogItemEdits";
import { catalogLookupFailure, catalogLookupOptionIds, taxIdProblem, withCatalogLookup } from "./catalogPartyLookup";

// Synthetic fields of a «Clientes» catalog: the tax id, the condition (an option of another catalog), the address and a decimal.
const taxId: CatalogFieldDraft = { ...newCatalogField("tax", 1), id: "01990000-0000-7000-8000-000000000101", key: "tax_id", name: { es: "CUIT" } };
const condition: CatalogFieldDraft = { ...newCatalogField("vat", 2), id: "01990000-0000-7000-8000-000000000102", key: "vat_condition", name: { es: "Condición frente al IVA" }, type: "catalog", sourceCatalogId: "01990000-0000-7000-8000-000000000200" };
const address: CatalogFieldDraft = { ...newCatalogField("address", 3), id: "01990000-0000-7000-8000-000000000103", key: "address", name: { es: "Domicilio" } };
const limit: CatalogFieldDraft = { ...newCatalogField("limit", 4), id: "01990000-0000-7000-8000-000000000104", key: "limit", name: { es: "Límite" }, type: "decimal" };
const retired: CatalogFieldDraft = { ...newCatalogField("retired", 5), id: "01990000-0000-7000-8000-000000000105", key: "old", name: { es: "Viejo" }, isActive: false };
const fields = [taxId, condition, address, limit, retired];
const option = "01990000-0000-7000-8000-000000000201";
const item: CatalogManualItemValue = { localId: "new", itemId: null, label: { es: null, en: null }, detail: { es: null, en: null }, code: "", value: null, isActive: true, position: null, fields: { [taxId.id!]: "30-50001091-2" } };

describe("the tax id before asking the registry", () => {
  it.each(["30500010912", "30-50001091-2", " 20 12345678 6 "])("accepts %j, whose check digit corresponds", value => expect(taxIdProblem(value)).toBeNull());
  it.each([[null, "required"], ["", "required"], [" - ", "required"], ["3050001091", "length"], ["305000109123", "length"], ["30.50001091.2", "length"], ["3050001091A", "length"],
    ["30500010913", "checkDigit"], ["20123456785", "checkDigit"], ["20000000010", "checkDigit"], ["20000000011", "checkDigit"]] as const)("rejects %j as %s", (value, problem) => expect(taxIdProblem(value)).toBe(problem));
});

describe("what the registry answered", () => {
  it("names a failure by the end of its stable code, without naming the module", () => {
    expect(catalogLookupFailure("Arca.Registry.CuitInvalid")).toBe("taxId");
    expect(catalogLookupFailure("Arca.Registry.PersonNotFound")).toBe("notFound");
    expect(catalogLookupFailure("Arca.Connection.Unavailable")).toBe("unavailable");
    expect(catalogLookupFailure("Arca.Connection.NotConnected")).toBe("other");
  });
  it("fills the text in the language being edited and each active field it knows, with the option texts of a catalog field", () => {
    const result = { text: "Agro del Sur S.A.", failureCode: null, failureMessage: null, fields: [
      { fieldId: taxId.id!.toUpperCase(), value: "30500010912" }, { fieldId: condition.id!, value: option }, { fieldId: address.id!, value: "Ruta 5 km 3, Junín" },
      { fieldId: limit.id!, value: "1500.5" }, { fieldId: retired.id!, value: "x" }, { fieldId: "01990000-0000-7000-8000-000000000999", value: "y" }] };
    const filled = withCatalogLookup({ ...item, label: { es: null, en: "Old" } }, result, fields, "es", "es", { [option]: { es: "Responsable inscripto", en: "Registered taxpayer" } });
    expect(filled.label).toEqual({ es: "Agro del Sur S.A.", en: "Old" });
    expect(filled.fields).toEqual({ [taxId.id!]: "30500010912", [condition.id!]: option, [address.id!]: "Ruta 5 km 3, Junín", [limit.id!]: "1.500,5" });
    expect(filled.fieldTexts).toEqual({ [condition.id!]: { es: "Responsable inscripto", en: "Registered taxpayer" } });
    expect(filled.localId).toBe("new");
  });
  it("keeps the text when the registry gives none, and drops a previous option's texts it cannot name", () => {
    const before = { ...item, label: { es: "Escrito", en: null }, fieldTexts: { [condition.id!]: { es: "Monotributo" } } };
    const filled = withCatalogLookup(before, { text: null, failureCode: null, failureMessage: null, fields: [{ fieldId: condition.id!, value: option }] }, fields, "es", "es");
    expect(filled.label).toEqual({ es: "Escrito", en: null });
    expect(filled.fields?.[condition.id!]).toBe(option);
    expect(filled.fieldTexts).toEqual({});
  });
  it("groups the options it still has to name by their source catalog", () => {
    const result = { text: "X", failureCode: null, failureMessage: null, fields: [{ fieldId: condition.id!, value: option }, { fieldId: address.id!, value: "Calle 1" }] };
    expect(catalogLookupOptionIds(result, fields)).toEqual(new Map([[condition.sourceCatalogId, [option]]]));
  });
});
