import { describe, expect, it } from "vitest";
import { responseCatalogColumnId, responseColumnDescriptors, visibleResponseColumnDescriptors, responseColumnSelection, responseCatalogFieldText, responseCatalogFieldCellText, type ResponseCatalogField, type ResponseColumn, type ResponseCell } from "./responses";
const fields: ResponseCatalogField[] = [{ fieldId: "tax", key: "tax", label: "CUIT", type: "text", role: "data" }, { fieldId: "zone", key: "zone", label: "Zona", type: "catalog", role: "filter" }];
const columns: ResponseColumn[] = [{ fieldId: "supplier", type: "multiChoice", label: "Proveedores", introducedInVersion: 1, options: [], fields }, { fieldId: "other", type: "shortText", label: "Otra", introducedInVersion: 1, options: [] }];
describe("response catalog column selection", () => {
 it("places data subcolumns after their question and keeps filters hidden by default", () => { expect(responseColumnDescriptors(columns).map(column => column.id)).toEqual(["supplier", responseCatalogColumnId("supplier", "tax"), responseCatalogColumnId("supplier", "zone"), "other"]); expect(visibleResponseColumnDescriptors(columns, null).map(column => column.id)).toEqual(["supplier", responseCatalogColumnId("supplier", "tax"), "other"]); });
 it("selects subcolumns independently from their base question and normalizes the public selection", () => { const id = responseCatalogColumnId("supplier", "zone"); expect(visibleResponseColumnDescriptors(columns, id).map(column => column.id)).toEqual([id]); expect(responseColumnSelection(columns, ["other", "supplier", responseCatalogColumnId("supplier", "tax")])).toBeNull(); expect(responseColumnSelection(columns, [id])).toBe(id); expect(responseColumnSelection(columns, [])).toBe("none"); });
});
it("formats each value by its captured type and never uses a catalog option ID as visible text", () => {
 const base = { fieldId: "field", label: "Campo", role: "data" as const };
 expect(responseCatalogFieldText({ ...base, type: "integer", value: "900719925474099123" }, "en", "Yes", "No")).toBe("900,719,925,474,099,123");
 expect(responseCatalogFieldText({ ...base, type: "decimal", value: "12.5" }, "es", "Sí", "No")).toBe("12,5");
 expect(responseCatalogFieldText({ ...base, type: "boolean", value: "false" }, "es", "Sí", "No")).toBe("No");
 expect(responseCatalogFieldText({ ...base, type: "date", value: "2026-10-23" }, "es", "Sí", "No")).toBe("23/10/2026");
 expect(responseCatalogFieldText({ ...base, type: "catalog", value: "private-guid", text: "Centro histórico" }, "es", "Sí", "No")).toBe("Centro histórico");
 expect(responseCatalogFieldText({ ...base, type: "catalog", value: "private-guid" }, "es", "Sí", "No")).toBe("—");
});
it("keeps multi-choice order, missing positions and historical absence", () => {
 const cell: ResponseCell = { fieldId: "supplier", type: "multiChoice", state: "Answered", value: [{ choiceId: "one", label: "Primero", fields: [{ fieldId: "tax", label: "CUIT", type: "text", role: "data", value: "30-1" }] }, { choiceId: "two", label: "Segundo" }, { choiceId: "three", label: "Tercero", fields: [{ fieldId: "tax", label: "CUIT", type: "text", role: "data", value: "30-3" }] }] };
 expect(responseCatalogFieldCellText(cell, "tax", "es", "Sí", "No")).toBe("30-1, —, 30-3");
 expect(responseCatalogFieldCellText(cell, "zone", "es", "Sí", "No")).toBe("—");
});
