import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { expect, it } from "vitest";
import { responseDetailSchema, responseSheetSchema, fetchResponseSheet, fetchResponseFacet } from "./responses";
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
