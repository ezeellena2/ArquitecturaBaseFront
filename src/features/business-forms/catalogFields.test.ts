import { describe, expect, it } from "vitest";
import { newCatalogField, parseCatalogFieldValue, formatCatalogFieldValue, catalogFieldsBody, type CatalogFieldDraft } from "./catalogFields";

const field: CatalogFieldDraft = { localId: "field", id: "01990000-0000-7000-8000-000000000001", key: "payment_days", name: { es: "Plazo", en: "Term" }, type: "decimal", sourceCatalogId: null, required: false, unique: false, min: "0", max: "180", maxLength: null, role: "data", position: 1, isActive: true, hasValues: false, usedBy: [] };

describe("catalog extra field values", () => {
  it("creates an optional unsaved field with an independent identity", () => {
    expect(newCatalogField("local-field", 4)).toMatchObject({ localId: "local-field", id: null, required: false, position: 4, role: "data", type: "text" });
  });
  it("uses the catalog culture for exact decimal input and preserves canonical values", () => {
    expect(parseCatalogFieldValue(field, "150,75", "es")).toEqual({ valid: true, value: "150.75" });
    expect(parseCatalogFieldValue({ ...field, max: null }, "9007199254740993.0123", "en")).toEqual({ valid: true, value: "9007199254740993.0123" });
    expect(formatCatalogFieldValue(field, "150.75", "es")).toBe("150,75");
    expect(parseCatalogFieldValue(field, "181", "es")).toEqual({ valid: false, reason: "range" });
  });
  it("keeps optional null distinct from false and validates required values and field types", () => {
    expect(parseCatalogFieldValue(field, " ", "es")).toEqual({ valid: true, value: null });
    expect(parseCatalogFieldValue({ ...field, required: true }, "", "es")).toEqual({ valid: false, reason: "required" });
    expect(parseCatalogFieldValue({ ...field, type: "boolean" }, "false", "es")).toEqual({ valid: true, value: "false" });
    expect(parseCatalogFieldValue({ ...field, type: "boolean" }, "sí", "es")).toEqual({ valid: false, reason: "invalid" });
    expect(parseCatalogFieldValue({ ...field, type: "catalog" }, "01990000-0000-7000-8000-000000000002", "es")).toMatchObject({ valid: true });
    expect(parseCatalogFieldValue({ ...field, type: "catalog" }, "Centro", "es")).toEqual({ valid: false, reason: "invalid" });
    expect(parseCatalogFieldValue({ ...field, type: "text", maxLength: 3 }, " cuatro ", "es")).toEqual({ valid: false, reason: "length" });
  });
  it("writes definitions without presentation-only usage metadata and without mutating names", () => {
    const body = catalogFieldsBody([field]);
    expect(body[0]).not.toHaveProperty("hasValues");
    expect(body[0]).not.toHaveProperty("usedBy");
    expect(body[0]).toMatchObject({ id: field.id, key: "payment_days", name: field.name, type: "decimal" });
    expect(body[0]?.name).not.toBe(field.name);
  });
  it("omits blank translations from field names instead of sending empty strings", () => {
    const body = catalogFieldsBody([{ ...field, name: { es: "Plazo", en: "" } }, { ...field, localId: "other", name: { es: " Monto ", en: "   " } }]);
    expect(body[0]?.name).toEqual({ es: "Plazo" });
    expect(body[1]?.name).toEqual({ es: "Monto" });
  });
  it("validates local bounds without throwing and rejects an empty catalog identity", () => {
    expect(parseCatalogFieldValue({ ...field, min: "1,5", max: "2,5" }, "2", "es")).toEqual({ valid: true, value: "2" });
    expect(parseCatalogFieldValue({ ...field, min: "bad" }, "2", "es")).toEqual({ valid: false, reason: "invalid" });
    expect(parseCatalogFieldValue({ ...field, type: "catalog" }, "00000000-0000-0000-0000-000000000000", "es")).toEqual({ valid: false, reason: "invalid" });
  });
});
