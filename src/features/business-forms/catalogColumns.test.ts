import { describe, expect, it } from "vitest";
import { catalogItemColumns, catalogTableColumns } from "./catalogColumns";
import { newCatalogField } from "./catalogFields";

describe("catalog option columns", () => {
  it("keeps the table and complete editor on the same ordered editable columns", () => {
    const columns = catalogItemColumns("Decimal", "en");
    expect(columns.map(column => column.id)).toEqual(["text", "code", "value", "detail", "isActive"]);
    expect(catalogTableColumns(columns, true).map(column => column.id)).toEqual(columns.map(column => column.id));
    expect(columns.find(column => column.id === "text")).toMatchObject({ errorPath: "text.en", maxLength: 30 });
    expect(columns.find(column => column.id === "value")).toMatchObject({ inputMode: "decimal", inputType: "text", required: true });
  });

  it("omits the value of a text catalog and folds the code into the readonly text column", () => {
    const columns = catalogItemColumns("Text", "es");
    expect(columns.map(column => column.id)).toEqual(["text", "code", "detail", "isActive"]);
    expect(catalogTableColumns(columns, false).map(column => column.id)).toEqual(["text", "detail", "isActive"]);
    expect(catalogTableColumns(columns, false)[0]?.tableLabelKey).toBe("catalogs.items.textAndCode");
    expect(columns[0]?.tableLabelKey).toBe("catalogs.items.text");
  });

  it("describes date-only and integer inputs without duplicating their presentation rules", () => {
    expect(catalogItemColumns("Date", "es").find(column => column.id === "value")).toMatchObject({ inputType: "date", inputMode: undefined });
    expect(catalogItemColumns("Integer", "es").find(column => column.id === "value")).toMatchObject({ inputType: "text", inputMode: "numeric" });
  });
  it("uses stable extra-field columns after code and keeps their saved and provisional identities", () => {
    const saved = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", name: { es: "CUIT", en: "Tax ID" } };
    const fresh = { ...newCatalogField("new", 2), name: { es: "Teléfono" } };
    const columns = catalogItemColumns("Text", "en", [saved, fresh, { ...saved, localId: "removed", isActive: false }]);
    expect(columns.map(column => column.id)).toEqual(["text", "code", "field:" + saved.id, "field:new", "detail", "isActive"]);
    expect(columns[2]).toMatchObject({ errorPath: "fields." + saved.id, field: saved });
    expect(columns[3]).toMatchObject({ field: fresh });
  });
});
