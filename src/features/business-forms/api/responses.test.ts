import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { expect, it } from "vitest";
import { responseCellSchema, responseDetailSchema, responseSheetSchema, fetchResponseSheet, fetchResponseFacet } from "./responses";
import { responseDetailFixture, responseSheetFixture } from "@/test/responseFixtures";
it("requires each row to belong to its declared version and field columns", () => {
  const sheet = responseSheetFixture();
  expect(responseSheetSchema.safeParse(sheet).success).toBe(true);
  const changed = structuredClone(sheet);
  changed.records.items[0].versionNumber = 999;
  expect(responseSheetSchema.safeParse(changed).success).toBe(false);
  const foreign = structuredClone(sheet);
  foreign.records.items[0].cells[0].fieldId =
    "0199a0c0-0000-7000-8000-000000000999";
  expect(responseSheetSchema.safeParse(foreign).success).toBe(false);
});

it("requires explicit PDF presence on every response row", () => {
  const sheet = responseSheetFixture();
  const body = { ...sheet, records: { ...sheet.records, items: sheet.records.items.map((row, index) => ({ ...row, hasPdf: index === 0 })) } };
  expect(responseSheetSchema.safeParse(body).success).toBe(true);
  expect(responseSheetSchema.safeParse({ ...body, records: { ...body.records, items: body.records.items.map(row => ({ ...row, hasPdf: undefined })) } }).success).toBe(false);
});
it.each(["Manual", "Assistant"])("requires the explicit %s sender kind without inventing an origin", senderKind => {
  const record = responseDetailFixture();
  const body = { ...record, origin: { ...record.origin, senderKind } };
  expect(responseDetailSchema.safeParse(body).success).toBe(true);
  expect(responseDetailSchema.safeParse({ ...body, origin: { ...body.origin, senderKind: undefined } }).success).toBe(false);
  expect(responseDetailSchema.safeParse({ ...body, origin: null }).success).toBe(true);
});


it.each(["Received", "PendingApproval", "Approved", "Rejected"] as const)("sends the exact %s state in search and facet count filter bodies", async state => {
  const sheet = responseSheetFixture();
  const requests: unknown[] = [];
  server.use(
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { requests.push(await request.json()); return HttpResponse.json(sheet); }),
    http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => { requests.push(await request.json()); return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false }); }),
  );
  const filter = { page: 1, pageSize: 20, state };
  const signal = new AbortController().signal;
  await fetchResponseSheet(sheet.definitionId, filter, signal);
  await fetchResponseFacet(sheet.definitionId, filter, "actor", undefined, 1, "", signal);
  expect(requests).toEqual([filter, { filter, dimension: "actor", page: 1, pageSize: 20, search: "" }]);
});

it("retains a sealed canonical catalog value without accepting half a pair or changing its historical label", () => {
  const captured = { choiceId: "01990000-0000-7000-8000-000000000021", label: "Tarifa histórica", catalogId: "01990000-0000-7000-8000-000000000020", catalogName: "Tarifas" };
  const cell = { fieldId: captured.choiceId, type: "choice", state: "Answered", value: captured };
  expect(responseCellSchema.safeParse(cell).success).toBe(true);
  for (const [valueType, value] of [["Integer", "999999999999999999"], ["Decimal", "9007199254740993.0123"], ["Date", "2028-02-29"]] as const) {
    expect(responseCellSchema.parse({ ...cell, value: { ...captured, valueType, value } }).value).toEqual({ ...captured, valueType, value });
  }
  for (const pair of [{ value: "12" }, { valueType: "Integer" }, { value: null, valueType: "Integer" }, { value: "12", valueType: "Text" }, { value: "12", valueType: "Boolean" }, { value: "01", valueType: "Integer" }, { value: "1.20", valueType: "Decimal" }, { value: "2026-02-29", valueType: "Date" }]) {
    expect(responseCellSchema.safeParse({ ...cell, value: { ...captured, ...pair } }).success).toBe(false);
  }
});

it("rejects a captured choice with null catalog metadata", () => {
  const captured = { choiceId: "01990000-0000-7000-8000-000000000021", label: "Tarifa histórica" };
  const cell = { fieldId: captured.choiceId, type: "choice", state: "Answered", value: captured };
  expect(responseCellSchema.safeParse(cell).success).toBe(true);
  for (const metadata of [{ catalogId: null }, { catalogName: null }, { detail: null }])
    expect(responseCellSchema.safeParse({ ...cell, value: { ...captured, ...metadata } }).success).toBe(false);
});

it("reads the sealed catalog type on a choice column even without rows and rejects unknown or misplaced types", () => {
  const sheet = responseSheetFixture();
  const choice = sheet.columns.find(column => column.type === "choice")!;
  const empty = { ...sheet, columns: [{ ...choice, valueType: "Decimal" }], records: { ...sheet.records, items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false } };
  expect(responseSheetSchema.parse(empty).columns[0]).toMatchObject({ valueType: "Decimal" });
  for (const valueType of [null, "Boolean", "Text"]) expect(responseSheetSchema.safeParse({ ...empty, columns: [{ ...choice, valueType }] }).success).toBe(false);
  expect(responseSheetSchema.safeParse({ ...empty, columns: [{ ...choice, type: "shortText", valueType: "Decimal" }] }).success).toBe(false);
});



it("keeps an ordered captured choice list, its typed pairs and an explicit empty list", () => {
  const option = { choiceId: "01990000-0000-7000-8000-000000000021", label: "Frío histórico", catalogId: "01990000-0000-7000-8000-000000000020", catalogName: "Fallas anteriores", detail: "Detalle conservado", valueType: "Decimal", value: "9007199254740993.0123" };
  const second = { choiceId: "01990000-0000-7000-8000-000000000022", label: "Ruido histórico" };
  const cell = { fieldId: option.choiceId, type: "multiChoice", state: "Answered", value: [second, option] };
  expect(responseCellSchema.parse(cell).value).toEqual([second, option]);
  expect(responseCellSchema.parse({ ...cell, state: "Unanswered", value: [] }).value).toEqual([]);
  expect(responseCellSchema.parse({ ...cell, state: "NotAsked", value: null }).value).toBeNull();
  const sheet = responseSheetFixture();
  const empty = { ...sheet, columns: [{ fieldId: option.choiceId, type: "multiChoice", label: "Fallas", introducedInVersion: 1, valueType: "Decimal", options: [{ id: option.choiceId, label: option.label }] }],
    records: { ...sheet.records, items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false } };
  expect(responseSheetSchema.parse(empty).columns[0]).toHaveProperty("valueType", "Decimal");
});
it.each(["scalar-option", "mixed-file", "unknown", "half-pair", "duplicate"])("rejects a malformed multi-choice projection: %s", invalid => {
  const option = { choiceId: "01990000-0000-7000-8000-000000000021", label: "private historical choice" };
  const file = { fileId: "01990000-0000-7000-8000-000000000022", name: "private.pdf", contentType: "application/pdf", size: 10, hasThumbnail: false };
  const values: Record<string, unknown> = { "scalar-option": option, "mixed-file": [option, file],
    unknown: [{ ...option, unknown: "private" }], "half-pair": [{ ...option, valueType: "Decimal" }], duplicate: [option, option] };
  expect(responseCellSchema.safeParse({ fieldId: option.choiceId, type: "multiChoice", state: "Answered", value: values[invalid] }).success).toBe(false);
  expect(responseCellSchema.safeParse({ fieldId: option.choiceId, type: "choice", state: "Answered", value: [option] }).success).toBe(false);
  expect(responseCellSchema.safeParse({ fieldId: option.choiceId, type: "document", state: "Answered", value: [option] }).success).toBe(false);
});

it("validates multi-choice detail rows with the same closed historical list shape", () => {
  const detail = responseDetailFixture();
  const option = { choiceId: "01990000-0000-7000-8000-000000000021", label: "Opción histórica", value: "2028-02-29", valueType: "Date" };
  const row = { fieldId: option.choiceId, key: "faults", type: "multiChoice", label: "Fallas", value: [option] };
  expect(responseDetailSchema.parse({ ...detail, values: [row] }).values[0].value).toEqual([option]);
  expect(responseDetailSchema.parse({ ...detail, values: [{ ...row, value: [] }] }).values[0].value).toEqual([]);
  expect(responseDetailSchema.parse({ ...detail, values: [{ ...row, value: null }] }).values[0].value).toBeNull();
  for (const value of [option, "private raw", [option, option], [{ ...option, extra: "private" }], [{ ...option, valueType: undefined }]]) {
    expect(responseDetailSchema.safeParse({ ...detail, values: [{ ...row, value }] }).success).toBe(false);
  }
});

it("does not reinterpret files as an unanswered multi-choice list", () => {
  const file = { fileId: "01990000-0000-7000-8000-000000000022", name: "private.pdf", contentType: "application/pdf", size: 10, hasThumbnail: false };
  expect(responseCellSchema.safeParse({ fieldId: file.fileId, type: "multiChoice", state: "Unanswered", value: [file] }).success).toBe(false);
});

it.each([
  ["Answered", []],
  ["Answered", null],
  ["Unanswered", [{ choiceId: "01990000-0000-7000-8000-000000000021", label: "Captured" }]],
  ["NotAsked", []],
  ["NotAsked", [{ choiceId: "01990000-0000-7000-8000-000000000021", label: "Captured" }]],
])("rejects an incoherent multi-choice %s cell without changing scalar contracts", (state, value) => {
  expect(responseCellSchema.safeParse({ fieldId: "01990000-0000-7000-8000-000000000022", type: "multiChoice", state, value }).success).toBe(false);
});
