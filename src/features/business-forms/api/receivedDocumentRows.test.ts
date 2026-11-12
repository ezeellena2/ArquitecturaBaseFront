import { describe, expect, it } from "vitest";
import { responseDetailFixture } from "@/test/responseFixtures";
import { receivedDocumentDetailFixture, receivedDocumentIds, receivedDocumentsPageFixture } from "@/test/visual/receivedDocumentFixtures";
import { readReceivedDocument, readReceivedDocuments } from "./receivedDocuments";
import { responseDetailSchema } from "./responses";

// VC1-A (task 26): each row of a spreadsheet that becomes a load is an entry of «Documentos recibidos», with its sheet (only when the
// book has more than one) and its number as Excel numbers it. The detail of a row brings its cells with the headers of its sheet instead
// of the viewer, and its history says it was sent as one of the loads of its spreadsheet or went over their limit. A response that came
// from a row says it in its origin («Salió de una planilla · {archivo}, fila {n}»). Every new field is absent when it does not apply:
// today's bodies keep their shape. Synthetic bodies until the joint export brings the cohort `forms-documents-http`.
const page = receivedDocumentsPageFixture();
const detail = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
const spreadsheet = { name: "cobranzas-semana.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 18_000, pages: null, stored: true };
const row = { ...detail.document, file: spreadsheet, row: { sheet: null, number: 5 } };
// The cells with content, in the order of their columns; a column without a header is named by its letter.
const cells = [{ header: "Fecha", value: "11/11/2026" }, { header: "Cliente", value: "Almacén Las Rosas" }, { header: "Importe", value: "61250" }, { header: "F", value: "Transferencia" }];
const at = detail.document.receivedAtUtc;
const step = (kind: string, value: string | null = null) => ({ atUtc: at, kind, actor: null, detail: value });
const rowDetail = { ...detail, document: row, reading: null, rowCells: cells, history: [step("received", "sure"), step("overLimit")] };

describe("a row in the inbox", () => {
  it("reads a row with its number, and its sheet when the book has more than one, in the page and in the detail", () => {
    const sales = { ...page.items[1], file: spreadsheet, row: { sheet: "Ventas", number: 12 } };
    expect(readReceivedDocuments({ ...page, items: [row, sales] }).items.map(item => item.row)).toEqual([{ sheet: null, number: 5 }, { sheet: "Ventas", number: 12 }]);
    expect(readReceivedDocument(rowDetail)).toEqual(rowDetail);
    expect(readReceivedDocument({ ...rowDetail, document: sales, history: [step("received", "sure")] }).document.row).toEqual({ sheet: "Ventas", number: 12 });
  });

  it("reads a row sent as one of the loads of its spreadsheet, up to three", () => {
    for (const load of ["1/1", "1/3", "2/3", "3/3", "2/2"])
      expect(readReceivedDocument({ ...rowDetail, history: [step("received", "sure"), step("sent", load)] }).history[1]).toEqual(step("sent", load));
  });

  it("reads today's page and detail without the new fields, and invents none", () => {
    const read = readReceivedDocuments(page);
    expect(read).toEqual(page);
    expect(read.items.some(item => "row" in item)).toBe(false);
    expect(readReceivedDocument(detail)).not.toHaveProperty("rowCells");
  });

  const withRow = (value: unknown) => ({ ...page, items: [{ ...row, row: value }] });
  it.each<[string, unknown]>([
    ["a null row", withRow(null)],
    ["a row that is a number", withRow(5)],
    ["a row without its sheet", withRow({ number: 5 })],
    ["an empty sheet", withRow({ sheet: "", number: 5 })],
    ["a row without its number", withRow({ sheet: null })],
    ["a row zero", withRow({ sheet: null, number: 0 })],
    ["a fractional row", withRow({ sheet: null, number: 2.5 })],
    ["a row number as text", withRow({ sheet: null, number: "5" })],
    ["a row with an unknown member", withRow({ sheet: null, number: 5, column: "B" })],
  ])("rejects a page with %s", (_case, body) => {
    expect(() => readReceivedDocuments(body)).toThrow("Unsupported form response.");
  });

  const { rowCells: _cells, ...withoutCells } = rowDetail;
  const withCells = (value: unknown) => ({ ...rowDetail, rowCells: value });
  it.each<[string, unknown]>([
    ["the cells of a document that is not a row", { ...detail, rowCells: cells }],
    ["a row without its cells", withoutCells],
    ["a row with the reading of a document", { ...rowDetail, reading: detail.reading }],
    ["null cells", withCells(null)],
    ["no cells", withCells([])],
    ["a cell without its header", withCells([{ value: "61250" }])],
    ["a cell with an empty header", withCells([{ header: "", value: "61250" }])],
    ["a cell without its value", withCells([{ header: "Importe" }])],
    ["an empty cell", withCells([{ header: "Importe", value: "" }])],
    ["a cell value as a number", withCells([{ header: "Importe", value: 61250 }])],
    ["a cell with an unknown member", withCells([{ header: "Importe", value: "61250", column: "C" }])],
    ["a load without saying which of the loads it was", { ...rowDetail, history: [step("sent")] }],
    ...["0/3", "4/4", "3/2", "1/4", "01/3", "1 de 3", "1/3 "].map((load): [string, unknown] => [`a load sent as «${load}»`, { ...rowDetail, history: [step("sent", load)] }]),
    ["a row over the limit with a detail", { ...rowDetail, history: [step("overLimit", "3")] }],
    // Only a row of a spreadsheet is one of its loads, or goes over their limit.
    ["a load on a document that is not a row", { ...detail, history: [step("received", "sure"), step("sent", "1/3")] }],
    ["a document that is not a row over the limit", { ...detail, history: [step("received", "sure"), step("overLimit")] }],
  ])("rejects a detail with %s", (_case, body) => {
    expect(() => readReceivedDocument(body)).toThrow("Unsupported form response.");
  });
});

// «Repetida: el mismo {dato} que {número}.» names the data that matched a response, together (the transfer receipt's rule matches its
// operation, its amount and its date); a row that repeats another row of the same spreadsheet (B5) names that row and its entry instead of
// a response. Both are absent when they do not apply.
describe("a repeated document or row", () => {
  const discarded = { ...row, state: "discarded", forReview: false, reasonCode: "duplicate", deleteAfterUtc: "2027-02-09T20:30:00Z" };
  const withRepetition = (repetition: unknown) => ({ ...rowDetail, document: discarded, history: [step("received", "duplicate")], proposal: { ...rowDetail.proposal, repetition } });
  const ofResponse = { atUtc: "2026-11-10T13:00:00Z", recordId: "0199b0c0-0000-7000-8000-000000000601", recordNumber: "COB-000120", documentId: null };
  const ofRow = { atUtc: at, recordId: null, recordNumber: null, documentId: receivedDocumentIds.waiting };
  it("reads the data that matched a response, the row of the same spreadsheet it repeats, and today's repetition without them", () => {
    for (const repetition of [{ ...ofResponse, labels: ["Número de recibo"] }, { ...ofRow, row: { sheet: null, number: 4 } }, { ...ofRow, row: { sheet: "Ventas", number: 4 } }, ofResponse])
      expect(readReceivedDocument(withRepetition(repetition)).proposal!.repetition).toEqual(repetition);
    const together = ["Número de operación", "Monto", "Fecha"];
    expect(readReceivedDocument({ ...detail, proposal: { ...detail.proposal, repetition: { ...ofResponse, labels: together } } }).proposal!.repetition!.labels).toEqual(together);
  });
  it.each<[string, unknown]>([
    ["no data", { ...ofResponse, labels: [] }],
    ["an empty datum", { ...ofResponse, labels: [""] }],
    ["a datum twice", { ...ofResponse, labels: ["Monto", "Monto"] }],
    ["null data", { ...ofResponse, labels: null }],
    ["data that are one text", { ...ofResponse, labels: "Monto" }],
    ["a datum that is not a text", { ...ofResponse, labels: [5] }],
    ["one datum under the singular name", { ...ofResponse, label: "Monto" }],
    ["a row without the entry of that row", { ...ofRow, documentId: null, row: { sheet: null, number: 4 } }],
    ["a row and a response", { ...ofResponse, documentId: receivedDocumentIds.waiting, row: { sheet: null, number: 4 } }],
    ["a null row", { ...ofRow, row: null }],
    ["a row without its sheet", { ...ofRow, row: { number: 4 } }],
    ["a row with an empty sheet", { ...ofRow, row: { sheet: "", number: 4 } }],
    ["a row zero", { ...ofRow, row: { sheet: null, number: 0 } }],
    ["a row with an unknown member", { ...ofRow, row: { sheet: null, number: 4, cells: [] } }],
  ])("rejects a repetition with %s", (_case, repetition) => {
    expect(() => readReceivedDocument(withRepetition(repetition))).toThrow("Unsupported form response.");
  });
});

describe("a response that came from a row", () => {
  const record = responseDetailFixture();
  const document = { id: "0199b0c0-0000-7000-8000-000000000005", name: "cobranzas-semana.xlsx" };
  const fromRow = (value: unknown) => ({ ...record, origin: { ...record.origin, document: { ...document, row: value } } });
  it("names the row of the spreadsheet it came from, and when the spreadsheet arrived", () => {
    for (const value of [{ sheet: null, number: 2, receivedAtUtc: "2026-11-11T20:30:00Z" }, { sheet: "Ventas", number: 5, receivedAtUtc: "2026-11-11T20:30:00.1234567Z" }])
      expect(responseDetailSchema.parse(fromRow(value)).origin?.document).toEqual({ ...document, row: value });
    expect(responseDetailSchema.parse({ ...record, origin: { ...record.origin, document } }).origin?.document).not.toHaveProperty("row");
  });
  it.each<[string, unknown]>([
    ["a null row", null],
    ["a row without the time its spreadsheet arrived", { sheet: null, number: 2 }],
    ["a row without its sheet", { number: 2, receivedAtUtc: "2026-11-11T20:30:00Z" }],
    ["an empty sheet", { sheet: "", number: 2, receivedAtUtc: "2026-11-11T20:30:00Z" }],
    ["a row zero", { sheet: null, number: 0, receivedAtUtc: "2026-11-11T20:30:00Z" }],
    ["a time in local time", { sheet: null, number: 2, receivedAtUtc: "2026-11-11T17:30:00-03:00" }],
    ["a row with an unknown member", { sheet: null, number: 2, receivedAtUtc: "2026-11-11T20:30:00Z", sheets: 1 }],
  ])("rejects %s", (_case, value) => {
    expect(responseDetailSchema.safeParse(fromRow(value)).success).toBe(false);
  });
});
