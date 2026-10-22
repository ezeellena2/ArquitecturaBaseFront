import { expect, it } from "vitest";
import { parseCatalogPaste } from "./catalogPaste";
it("preserves quoted tabs, line breaks, escaped quotes and empty cells while producing one CSV for server preview", () => {
  expect(parseCatalogPaste('Código\tTexto\tDetalle\r\nA\t"Norte\tSur"\t"Una ""cita""\ny otra"\r\nB\tSur\t')).toEqual({ valid: true, csv: '"Código","Texto","Detalle"\r\n"A","Norte\tSur","Una ""cita""\ny otra"\r\n"B","Sur",""', rowCount: 2, columnCount: 3 });
});
it("keeps headers for the server, accepts an empty sheet and does not interpret formulas or localized values", () => {
  expect(parseCatalogPaste('Code\tText\tValue (decimal)\n')).toMatchObject({ valid: true, rowCount: 0, columnCount: 3 });
  expect(parseCatalogPaste('Code\tText\tValue\nA\t=SUM(A1:A2)\t1.500,50')).toMatchObject({ valid: true, csv: '"Code","Text","Value"\r\n"A","=SUM(A1:A2)","1.500,50"' });
});
it("rejects broken quoting and excessive columns without inventing rows", () => {
  expect(parseCatalogPaste('Code\tText\nA\t"open')).toEqual({ valid: false, reason: "format" });
  expect(parseCatalogPaste(Array.from({ length: 65 }, () => "Header").join("\t"))).toEqual({ valid: false, reason: "limit" });
});

it.each([
  ['Caño 1/2"', '"Code","Text"\r\n"A","Caño 1/2"""'],
  ['Codo "T"', '"Code","Text"\r\n"A","Codo ""T"""'],
])("preserves literal quotes inside the unquoted pasted cell %s", (text, csv) => {
  expect(parseCatalogPaste("Code\tText\nA\t" + text)).toEqual({ valid: true, csv, rowCount: 1, columnCount: 2 });
});
