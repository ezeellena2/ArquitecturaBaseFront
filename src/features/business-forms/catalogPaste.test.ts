import { describe, expect, it } from "vitest";
import { catalogPasteColumns, catalogPasteCsv, catalogPasteExtraColumns, readCatalogPaste, type CatalogPastedSheet } from "./catalogPaste";
// The paste grid (IM3-A, 2026-10-31): its header is the catalog's columns in the template's order; rows go in that order and
// a header row, when it comes, places each column.
describe("rows pasted into the catalog's columns", () => {
  const zone = { id: "01990000-0000-7000-8000-000000000301", key: "zona", name: { es: "Zona", en: "Zone" } };
  const days = { id: "01990000-0000-7000-8000-000000000302", key: "plazo_dias", name: { es: "Plazo de pago" } };
  const fixed: Record<string, string> = { code: "Código", text: "Texto", detail: "Detalle", active: "Activa", value: "Valor", textEn: "Texto en inglés", detailEn: "Detalle en inglés" };
  const labels = { fixed: (id: string) => fixed[id]!, field: (field: { name: Readonly<Record<string, string | null | undefined>> }) => field.name.es ?? "" };
  const columns = catalogPasteColumns("Text", [zone, days], labels);
  const sheet = (result: ReturnType<typeof readCatalogPaste>): CatalogPastedSheet => { if (!result.valid) throw new Error(result.reason); return result.sheet; };

  it("takes rows without headers in the order of the catalog's columns and sends only the pasted ones", () => {
    const pasted = sheet(readCatalogPaste("N\tNorte\tZona norte\nS\tSur\t\n", columns));
    expect(pasted.columns.map(column => [column.id, column.label, column.source])).toEqual([["code", "Código", 0], ["text", "Texto", 1], ["detail", "Detalle", 2], ["active", "Activa", -1], [zone.id, "Zona", -1], [days.id, "Plazo de pago", -1]]);
    expect(pasted.rows).toEqual([["N", "Norte", "Zona norte"], ["S", "Sur", ""]]);
    // An absent column keeps its values on import: only the pasted columns travel.
    expect(catalogPasteCsv(pasted)).toBe('"Code","Text","Detail"\r\n"N","Norte","Zona norte"\r\n"S","Sur",""');
  });
  it("uses a header row in any order, sends its headers as they came and leaves out a column that is not the catalog's", () => {
    const pasted = sheet(readCatalogPaste("Texto\tCódigo\tTeléfono\tzona\nNorte\tN\t0342\tCentro\n", columns));
    expect(pasted.columns.map(column => [column.id, column.label, column.source])).toEqual([["code", "Código", 1], ["text", "Texto", 0], ["detail", "Detalle", -1], ["active", "Activa", -1], [zone.id, "Zona", 3], [days.id, "Plazo de pago", -1], [null, "Teléfono", 2]]);
    expect(pasted.rows).toEqual([["Norte", "N", "0342", "Centro"]]);
    expect(catalogPasteCsv(pasted)).toBe('"Texto","Código","zona"\r\n"Norte","N","Centro"');
  });
  it.each(["zona", "Zona", "ZONE", "Zona [campo]", "Zone [field]"])("places a field named %s by its key or its name in either language", header => {
    expect(sheet(readCatalogPaste("Code\t" + header + "\nN\tCentro", columns)).columns.find(column => column.id === zone.id)?.source).toBe(1);
  });
  it("names a pasted column beyond the catalog's only by its position and does not send it", () => {
    const pasted = sheet(readCatalogPaste("N\tNorte\tx\tSí\tCentro\t30\tsobra", columns));
    expect(pasted.columns.at(-1)).toEqual({ id: null, label: null, source: 6 });
    expect(catalogPasteCsv(pasted)).toBe('"Code","Text","Detail","Active","zona","plazo_dias"\r\n"N","Norte","x","Sí","Centro","30"');
  });
  it("writes a field whose key is a fixed column's name with [field], as the server reads it", () => {
    const code = { id: "01990000-0000-7000-8000-000000000303", key: "codigo", name: { es: "Código interno" } };
    const pasted = sheet(readCatalogPaste("N\tNorte\t\t\tA-1", catalogPasteColumns("Text", [code], labels)));
    expect(catalogPasteCsv(pasted)).toBe('"Code","Text","Detail","Active","codigo [field]"\r\n"N","Norte","","","A-1"');
  });
  it("adds the value of a typed catalog and the translation columns that come with their headers", () => {
    const typed = catalogPasteColumns("Decimal", [], labels);
    expect(typed.map(column => column.id)).toEqual(["code", "text", "detail", "active", "value"]);
    for (const header of ["Valor", "Value (decimal)"]) expect(sheet(readCatalogPaste("Código\t" + header + "\nN\t1,5", typed)).columns.find(column => column.id === "value")?.source).toBe(1);
    const pasted = sheet(readCatalogPaste("Código\tTexto en inglés\nN\tNorth", columns, catalogPasteExtraColumns("es", labels)));
    expect(pasted.columns.at(-1)).toEqual({ id: "textEn", label: "Texto en inglés", source: 1 });
    expect(catalogPasteCsv(pasted)).toBe('"Código","Texto en inglés"\r\n"N","North"');
  });
  it("keeps quoted tabs, line breaks and quotes in a cell and drops empty rows", () => {
    expect(sheet(readCatalogPaste('A\t"Norte\tSur"\t"Una ""cita""\ny otra"\n\t\t\nB\tSur', columns)).rows).toEqual([["A", "Norte\tSur", 'Una "cita"\ny otra'], ["B", "Sur"]]);
  });
  it("quotes tabs, line breaks, quotes and empty cells for the server's CSV", () => {
    expect(catalogPasteCsv(sheet(readCatalogPaste('Código\tTexto\tDetalle\r\nA\t"Norte\tSur"\t"Una ""cita""\ny otra"\r\nB\tSur\t', columns))))
      .toBe('"Código","Texto","Detalle"\r\n"A","Norte\tSur","Una ""cita""\ny otra"\r\n"B","Sur",""');
  });
  it.each([
    ['Caño 1/2"', '"Code","Text"\r\n"A","Caño 1/2"""'],
    ['Codo "T"', '"Code","Text"\r\n"A","Codo ""T"""'],
  ])("keeps the literal quotes of the unquoted cell %s", (text, csv) => {
    expect(catalogPasteCsv(sheet(readCatalogPaste("Code\tText\nA\t" + text, columns)))).toBe(csv);
  });
  it("does not interpret formulas or localized values: the server reads them", () => {
    expect(catalogPasteCsv(sheet(readCatalogPaste("Code\tText\tValue\nA\t=SUM(A1:A2)\t1.500,50", catalogPasteColumns("Decimal", [], labels)))))
      .toBe('"Code","Text","Value"\r\n"A","=SUM(A1:A2)","1.500,50"');
  });
  it("rejects broken quoting, too many columns and an empty paste", () => {
    expect(readCatalogPaste('A\t"open', columns)).toEqual({ valid: false, reason: "format" });
    expect(readCatalogPaste(Array.from({ length: 65 }, () => "x").join("\t"), columns)).toEqual({ valid: false, reason: "limit" });
    expect(readCatalogPaste(" \n\t\n", columns)).toEqual({ valid: false, reason: "format" });
  });
});
