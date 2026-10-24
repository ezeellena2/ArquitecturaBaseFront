import { describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { newCatalogField, parseCatalogFieldValue, formatCatalogFieldValue, catalogFieldsBody, catalogFieldProblemText, catalogFieldRowReason, catalogFieldRuleSummary, catalogFieldInputHint, groupCatalogFieldUses, type CatalogFieldDraft } from "./catalogFields";
import type { CatalogFieldUsage } from "./api/catalogResponse";

const field: CatalogFieldDraft = { localId: "field", id: "01990000-0000-7000-8000-000000000001", key: "payment_days", name: { es: "Plazo", en: "Term" }, type: "decimal", sourceCatalogId: null, required: false, unique: false, min: "0", max: "180", maxLength: null, role: "data", position: 1, isActive: true, valuesCount: 0, usedBy: [] };

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
    expect(body[0]).not.toHaveProperty("valuesCount");
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
  it("describes a field problem with its value and the reason for its type", async () => {
    await i18n.loadLanguages("en");
    const es = i18n.getFixedT("es", "forms"), en = i18n.getFixedT("en", "forms");
    expect(catalogFieldProblemText(es, field, null, "required", "es")).toBe("Falta: es obligatorio.");
    expect(catalogFieldProblemText(es, { ...field, type: "integer" }, " 30 días ", "invalid", "es")).toBe("«30 días» no es un número entero.");
    expect(catalogFieldProblemText(es, field, "treinta", "invalid", "es")).toBe("«treinta» no es un número.");
    expect(catalogFieldProblemText(es, { ...field, type: "date", min: null, max: null }, "mañana", "invalid", "es")).toBe("«mañana» no es una fecha.");
    expect(catalogFieldProblemText(es, { ...field, type: "boolean", min: null, max: null }, "quizás", "invalid", "es")).toBe("«quizás» no es sí o no.");
    expect(catalogFieldProblemText(es, { ...field, type: "catalog", min: null, max: null }, "Centro", "invalid", "es")).toBe("«Centro» no es una opción del catálogo.");
    expect(catalogFieldProblemText(es, { ...field, type: "text", min: null, max: null }, "a\u0000b", "invalid", "es")).toBe("«a\u0000b» tiene caracteres que no se pueden guardar.");
    expect(catalogFieldProblemText(es, field, "181", "range", "es")).toBe("«181» está fuera del rango: de 0 a 180.");
    expect(catalogFieldProblemText(es, { ...field, max: null }, "-1", "range", "es")).toBe("«-1» está fuera del rango: desde 0.");
    expect(catalogFieldProblemText(es, { ...field, min: null }, "181", "range", "es")).toBe("«181» está fuera del rango: hasta 180.");
    expect(catalogFieldProblemText(es, { ...field, type: "text", min: null, max: null, maxLength: 13 }, "20-12345678-90", "length", "es")).toBe("«20-12345678-90» supera los 13 caracteres.");
    expect(catalogFieldProblemText(es, { ...field, type: "text", min: null, max: null, maxLength: 1 }, "AB", "length", "es")).toBe("«AB» supera 1 carácter.");
    expect(catalogFieldProblemText(es, { ...field, type: "text", min: null, max: null, maxLength: null }, "x".repeat(301), "length", "es")).toBe("«" + "x".repeat(40) + "…» supera los 300 caracteres.");
    expect(catalogFieldProblemText(en, { ...field, type: "integer" }, "30 days", "invalid", "en")).toBe("“30 days” is not a whole number.");
    expect(catalogFieldProblemText(en, { ...field, type: "text", min: null, max: null }, "a\u0000b", "invalid", "en")).toBe("“a\u0000b” has characters that cannot be saved.");
    expect(catalogFieldProblemText(en, { ...field, type: "text", min: null, max: null, maxLength: 1 }, "AB", "length", "en")).toBe("“AB” is longer than 1 character.");
    expect(catalogFieldProblemText(en, { ...field, type: "text", min: null, max: null, maxLength: 13 }, "20-12345678-90", "length", "en")).toBe("“20-12345678-90” is longer than 13 characters.");
    expect(catalogFieldProblemText(en, field, "181", "range", "en")).toBe("“181” is out of range: from 0 to 180.");
    expect(catalogFieldProblemText(en, field, null, "required", "en")).toBe("Missing: it is required.");
  });
  it("summarizes a field's range or length", async () => {
    await i18n.loadLanguages("en");
    const es = i18n.getFixedT("es", "forms"), en = i18n.getFixedT("en", "forms");
    expect(catalogFieldRuleSummary({ ...field, type: "integer" }, "es", es)).toBe("De 0 a 180");
    expect(catalogFieldRuleSummary({ ...field, min: "1.500,5", max: null }, "es", es)).toBe("Desde 1.500,5");
    expect(catalogFieldRuleSummary({ ...field, type: "date", min: null, max: "2026-12-31" }, "es", es)).toBe("Hasta 31/12/2026");
    expect(catalogFieldRuleSummary({ ...field, min: "abc", max: null }, "es", es)).toBe("Desde abc");
    expect(catalogFieldRuleSummary({ ...field, type: "text", min: null, max: null, maxLength: 13 }, "es", es)).toBe("13 caracteres");
    expect(catalogFieldRuleSummary({ ...field, type: "text", min: null, max: null, maxLength: 1 }, "es", es)).toBe("1 carácter");
    expect(catalogFieldRuleSummary({ ...field, min: "1,500.5", max: "2500" }, "en", en)).toBe("From 1,500.5 to 2,500");
    expect(catalogFieldRuleSummary({ ...field, type: "date", min: "2026-01-02", max: null }, "en", en)).toBe("From 01/02/2026");
    expect(catalogFieldRuleSummary({ ...field, min: null, max: "180" }, "en", en)).toBe("Up to 180");
    expect(catalogFieldRuleSummary({ ...field, type: "text", min: null, max: null, maxLength: 13 }, "en", en)).toBe("13 characters");
    for (const empty of [{ ...field, min: null, max: " " }, { ...field, type: "text", min: null, max: null, maxLength: null }, { ...field, type: "boolean", min: null, max: null }, { ...field, type: "catalog", min: null, max: null }] as const) {
      expect(catalogFieldRuleSummary(empty, "es", es)).toBeNull();
    }
  });
  it("gives an integer, decimal or date value its type and range as help", async () => {
    await i18n.loadLanguages("en");
    const es = i18n.getFixedT("es", "forms"), en = i18n.getFixedT("en", "forms");
    expect(catalogFieldInputHint({ ...field, type: "integer" }, "es", es)).toBe("Entero, de 0 a 180.");
    expect(catalogFieldInputHint({ ...field, min: "1.500,5", max: null }, "es", es)).toBe("Número decimal, desde 1.500,5.");
    expect(catalogFieldInputHint({ ...field, type: "date", min: null, max: "2026-12-31" }, "es", es)).toBe("Fecha, hasta 31/12/2026.");
    expect(catalogFieldInputHint({ ...field, type: "integer", min: null, max: null }, "es", es)).toBe("Entero.");
    expect(catalogFieldInputHint({ ...field, type: "integer" }, "en", en)).toBe("Whole number, from 0 to 180.");
    expect(catalogFieldInputHint({ ...field, type: "date", min: "2026-01-02", max: null }, "en", en)).toBe("Date, from 01/02/2026.");
    for (const type of ["text", "boolean", "catalog"] as const) expect(catalogFieldInputHint({ ...field, type }, "es", es)).toBeNull();
  });
  it("words an out-of-range value with the bounds of its help, in the draft culture", async () => {
    await i18n.loadLanguages("en");
    const es = i18n.getFixedT("es", "forms"), en = i18n.getFixedT("en", "forms");
    const due = { ...field, type: "date" as const, min: null, max: "2026-12-31" };
    expect(catalogFieldInputHint(due, "es", es)).toBe("Fecha, hasta 31/12/2026.");
    expect(catalogFieldProblemText(es, due, "1/1/2027", "range", "es")).toBe("«1/1/2027» está fuera del rango: hasta 31/12/2026.");
    expect(catalogFieldProblemText(es, { ...field, min: "1500,5", max: null }, "2", "range", "es")).toBe("«2» está fuera del rango: desde 1.500,5.");
    expect(catalogFieldProblemText(en, { ...due, min: "2026-01-02", max: null }, "2025-12-31", "range", "en")).toBe("“2025-12-31” is out of range: from 01/02/2026.");
    expect(catalogFieldProblemText(en, { ...field, min: "1,500.5", max: "2500" }, "3000", "range", "en")).toBe("“3000” is out of range: from 1,500.5 to 2,500.");
  });
  it("says a value is repeated when «único» is switched on or a unique field is restored", async () => {
    await i18n.loadLanguages("en");
    const es = i18n.getFixedT("es", "forms"), en = i18n.getFixedT("en", "forms");
    const unique = { ...field, type: "text" as const, min: null, max: null, unique: true };
    expect(catalogFieldRowReason("unique", unique, "invalid")).toBe("repeated");
    expect(catalogFieldRowReason("isActive", unique, "invalid")).toBe("repeated");
    expect(catalogFieldRowReason("isActive", unique, "length")).toBe("length");
    expect(catalogFieldRowReason("isActive", { ...unique, unique: false }, "invalid")).toBe("invalid");
    expect(catalogFieldRowReason("type", unique, "invalid")).toBe("invalid");
    expect(catalogFieldProblemText(es, unique, " 30 días ", "repeated", "es")).toBe("«30 días» se repite en otra opción activa.");
    expect(catalogFieldProblemText(en, unique, "30 days", "repeated", "en")).toBe("“30 days” is repeated in another active option.");
  });
  it("groups the draft and active uses of one question and keeps the catalog's own use apart", () => {
    const form = "01990000-0000-7000-8000-000000000002", supplier = "01990000-0000-7000-8000-000000000004", zone = "01990000-0000-7000-8000-000000000005";
    const hidden = { definitionId: null, formName: null, question: null, questionId: null };
    const uses: readonly CatalogFieldUsage[] = [
      { definitionId: form, formName: "Pedir repuesto", question: "Proveedor", questionId: supplier, stage: "Draft" },
      { definitionId: null, formName: "Proveedores", question: null, questionId: null, stage: "Catalog" },
      { definitionId: form, formName: "Pedir repuesto", question: "Proveedor", questionId: supplier, stage: "Active" },
      { definitionId: form, formName: "Pedir repuesto", question: "Zona", questionId: zone, stage: "Active" },
      { definitionId: form, formName: "Pedir repuesto", question: "Proveedor", questionId: supplier, stage: "Draft" },
      { ...hidden, stage: "Active" },
      { ...hidden, stage: "Active" },
    ];
    expect(groupCatalogFieldUses(uses)).toEqual({
      questions: [
        { definitionId: form, questionId: supplier, formName: "Pedir repuesto", question: "Proveedor", stages: ["Active", "Draft"] },
        { definitionId: form, questionId: zone, formName: "Pedir repuesto", question: "Zona", stages: ["Active"] },
        { ...hidden, stages: ["Active"] },
        { ...hidden, stages: ["Active"] },
      ],
      catalog: true,
    });
    expect(groupCatalogFieldUses(uses.filter(use => use.stage !== "Catalog")).catalog).toBe(false);
  });
});
