import { expect, it } from "vitest";
import { responseDetailFixture, responseSheetFixture } from "@/test/responseFixtures";
import { responseDetailSchema, responseSheetSchema } from "./responses";

// RE1-A: what an external action left in a response reaches the detail above «Datos» and the sheet as a column per datum.
const values = [
  { key: "voucher", label: "Comprobante", kind: "text", value: "Factura C 0004-00000012" },
  { key: "authorization", label: "Código de autorización", kind: "text", value: "74512345678901" },
  { key: "expiresOn", label: "Vencimiento del código", kind: "date", value: "2026-11-19" },
];
const result = { source: "arca.invoice", name: "Emitir comprobante en ARCA", recordedAtUtc: "2026-11-09T20:00:00Z", values };
const columns = values.map(value => ({ id: "arca.invoice." + value.key, source: "arca.invoice", sourceName: "Emitir comprobante en ARCA", key: value.key, label: value.label, kind: value.kind }));

it("reads the results of the detail, and a detail without them as before", () => {
  const detail = responseDetailFixture();
  expect(responseDetailSchema.parse({ ...detail, results: [result] }).results).toEqual([result]);
  expect(responseDetailSchema.parse(detail).results).toBeUndefined();
  expect(responseDetailSchema.safeParse({ ...detail, results: [] }).success).toBe(false);
  expect(responseDetailSchema.safeParse({ ...detail, results: [{ ...result, values: [{ ...values[0], kind: "currency" }] }] }).success).toBe(false);
});

it("reads the result columns of the sheet and each row's values, only of those columns", () => {
  const sheet = responseSheetFixture();
  const withResults = {
    ...sheet, resultColumns: columns,
    records: { ...sheet.records, items: sheet.records.items.map((row, index) => index === 0 ? { ...row, results: { "arca.invoice.voucher": "Factura C 0004-00000012", "arca.invoice.expiresOn": null } } : row) },
  };
  const parsed = responseSheetSchema.parse(withResults);
  expect(parsed.resultColumns).toEqual(columns);
  expect(parsed.records.items[0]?.results).toEqual({ "arca.invoice.voucher": "Factura C 0004-00000012", "arca.invoice.expiresOn": null });
  expect(responseSheetSchema.parse(sheet).resultColumns).toBeUndefined();
  const foreign = { ...withResults, records: { ...withResults.records, items: withResults.records.items.map((row, index) => index === 0 ? { ...row, results: { "other.voucher": "1" } } : row) } };
  expect(responseSheetSchema.safeParse(foreign).success).toBe(false);
});
