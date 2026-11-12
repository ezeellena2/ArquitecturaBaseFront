import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { receivedDocumentDetailFixture, receivedDocumentIds, receivedDocumentsPageFixture } from "@/test/visual/receivedDocumentFixtures";
import { changeReceivedDocumentForm, discardReceivedDocument, fetchReceivedDocument, fetchReceivedDocumentExtraction, fetchReceivedDocumentFile,
  fetchReceivedDocumentMenuCounts, fetchReceivedDocuments, passReceivedDocument, readReceivedDocument, readReceivedDocumentExtraction,
  readReceivedDocumentMenuCounts, readReceivedDocumentRecord, readReceivedDocuments, reopenReceivedDocument, searchReceivedDocumentOptions } from "./receivedDocuments";

// «Documentos recibidos» (DOC5-A, task 10): strict guards on the backend's shape of task 7 and its correction «7b», with synthetic
// bodies until the coordinator exports the cohort `forms-documents-http` (no *HttpContract test until then).
const page = receivedDocumentsPageFixture();
const detail = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
const id = receivedDocumentIds.forReview;
const requestId = "0199b0c0-0000-7000-8000-000000000901";

describe("the guards", () => {
  it("read a page with the counts and the forms and people of the filters, a detail, the counter, a change of form and a pass", () => {
    expect(readReceivedDocuments(page)).toEqual(page);
    expect(readReceivedDocument(detail)).toEqual(detail);
    expect(readReceivedDocumentMenuCounts({ forReview: 2, unclassified: 5, total: 7 }).total).toBe(7);
    expect(readReceivedDocumentExtraction({ requestId, state: "pending", failureCode: null }).state).toBe("pending");
    expect(readReceivedDocumentExtraction({ requestId, state: "failed", failureCode: "Forms.ReceivedDocument.Unrecognized" }).failureCode).toBe("Forms.ReceivedDocument.Unrecognized");
    expect(readReceivedDocumentRecord({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }).number).toBe("REC-000125");
    // The person chose a form of a doubt in the channel, a step the channel port records.
    expect(readReceivedDocument({ ...detail, history: [...detail.history, { atUtc: "2026-10-21T21:20:00Z", kind: "formChosen", actor: null, detail: null }] }).history).toHaveLength(2);
    // The seven fractional digits the backend writes.
    expect(readReceivedDocuments({ ...page, items: [{ ...page.items[0], receivedAtUtc: "2026-10-22T15:04:00.1234567Z" }] }).items[0]!.receivedAtUtc).toBe("2026-10-22T15:04:00.1234567Z");
    // A rejected file the inbox kept no copy of, also without its size when WhatsApp never said it (one over the limit).
    expect(readReceivedDocuments({ ...page, items: [page.items[8]] }).items[0]!.file.stored).toBe(false);
    expect(readReceivedDocuments({ ...page, items: [{ ...page.items[8], file: { ...page.items[8]!.file, size: null } }] }).items[0]!.file.size).toBeNull();
    // Without «Revisar documentos» there is no form to read it for, and a choice comes without its options.
    const readOnly = readReceivedDocument(receivedDocumentDetailFixture(id, "es", false));
    expect(readOnly.forms).toEqual([]);
    expect(readOnly.proposal!.candidates[0]!.values.filter(entry => entry.type === "choice").map(entry => entry.options)).toEqual([[], [], [], []]);
    // The options of a choice that chooses first by a field come with their group; the lists of the filters say when they were cut.
    const grouped = [{ id: requestId, text: "San Martín", group: "Buenos Aires" }, { id: receivedDocumentIds.other, text: "San Martín", group: "Mendoza" }];
    const choice = detail.proposal!.candidates[0]!.values[2]!;
    expect(readReceivedDocument({ ...detail, proposal: { ...detail.proposal, candidates: [{ ...detail.proposal!.candidates[0], values: [{ ...choice, options: grouped }] }] } })
      .proposal!.candidates[0]!.values[0]!.options).toEqual(grouped);
    expect(readReceivedDocuments({ ...page, facets: { ...page.facets, formsTruncated: true } }).facets.formsTruncated).toBe(true);
    // A catalog choice the server does not list: too many options for its sender (searched apart), or a datum the catalog filters by
    // that its sender lacks.
    const unlisted = (optionsUnavailable: unknown) => ({ ...detail, proposal: { ...detail.proposal, candidates: [{ ...detail.proposal!.candidates[0], values: [{ ...choice, options: [], optionsUnavailable }] }] } });
    expect(readReceivedDocument(unlisted({ reason: "tooMany" })).proposal!.candidates[0]!.values[0]!.optionsUnavailable).toEqual({ reason: "tooMany" });
    expect(readReceivedDocument(unlisted({ reason: "missingData", datum: "Provincia" })).proposal!.candidates[0]!.values[0]!.optionsUnavailable).toEqual({ reason: "missingData", datum: "Provincia" });
  });

  const item = page.items[0]!;
  const waiting = page.items[5]!;
  const value = detail.proposal!.candidates[0]!.values[1]!;
  const choice = detail.proposal!.candidates[0]!.values[2]!;
  const withItem = (changes: Record<string, unknown>, base: object = item) => ({ ...page, items: [{ ...base, ...changes }] });
  const withValue = (changes: Record<string, unknown>, base: object = value) =>
    ({ ...detail, proposal: { ...detail.proposal, candidates: [{ ...detail.proposal!.candidates[0], values: [{ ...base, ...changes }] }] } });
  const { replyExpiresAtUtc: _deadline, ...undated } = item;
  const { facets: _facets, ...withoutFacets } = page;
  const { forms: _forms, ...withoutForms } = detail;
  it.each<[string, unknown]>([
    ["an unknown member", { ...page, private: true }],
    ["an unknown state", withItem({ state: "archived" })],
    ["a document for review that is not proposed", withItem({ forReview: true, state: "confirmed", record: { recordId: requestId, number: "REC-1" } })],
    ["a response of a document that is not confirmed", withItem({ record: { recordId: requestId, number: "REC-1" } })],
    ["a deletion date of a proposed document", withItem({ deleteAfterUtc: "2027-01-20T12:00:00Z" })],
    ["four data that help find it", withItem({ highlights: [0, 1, 2, 3].map(n => ({ fieldId: `0199b0c0-0000-7000-8000-00000000091${n}`, label: "Dato " + n, value: String(n) })) })],
    ["a datum that helps find it twice", withItem({ highlights: [item.highlights[0], item.highlights[0]] })],
    ["a date in local time", withItem({ receivedAtUtc: "2026-10-22T12:04:00-03:00" })],
    ["a file that does not say whether its copy was kept", withItem({ file: (({ stored: _stored, ...rest }) => rest)(item.file) })],
    ["a kept file without its size", withItem({ file: { ...item.file, size: null } })],
    ["a revision zero", withItem({ revision: 0 })],
    ["a document without the deadline of its reply", { ...page, items: [undated] }],
    ["a deadline of a document nobody waits for", withItem({ replyExpiresAtUtc: "2026-10-23T15:04:00Z" })],
    ["a document that waits for its person without a deadline", withItem({ replyExpiresAtUtc: null }, waiting)],
    ["more for review than proposed", { ...page, counts: { ...page.counts, forReview: 4 } }],
    ["more rows than the page holds", { ...page, pageSize: 2 }],
    ["no forms and people for the filters", withoutFacets],
    ["a form twice in the filter", { ...page, facets: { ...page.facets, forms: [page.facets.forms[0], page.facets.forms[0]] } }],
    ["a person twice in the filter", { ...page, facets: { ...page.facets, senders: [page.facets.senders[0], page.facets.senders[0]] } }],
    ["filters that do not say whether their lists were cut", { ...page, facets: { forms: page.facets.forms, senders: page.facets.senders } }],
  ])("rejects a page with %s", (_case, body) => {
    expect(() => readReceivedDocuments(body)).toThrow("Unsupported form response.");
  });
  it.each<[string, unknown]>([
    ["a datum read without a value", withValue({ value: null, mark: null })],
    ["a datum not read with a value", withValue({ mark: "notRead" })],
    ["a validation code on a datum that passes", withValue({ errorCode: "Forms.Record.BankAccountInvalid" })],
    ["an invalid datum without its code", withValue({ mark: "invalid" })],
    ["an unknown question type", withValue({ type: "location" })],
    ["a datum without its options member", withValue({}, (({ options: _options, ...rest }) => rest)(value))],
    ["options of a datum that is not a choice", withValue({ options: [{ id: requestId, text: "Uno" }] })],
    ["a choice without its options", withValue({ options: null }, choice)],
    ["an option twice", withValue({ options: [choice.options![0], choice.options![0]] }, choice)],
    ["an option without its group", withValue({ options: [{ id: requestId, text: "Pesos" }] }, choice)],
    ["a datum without saying whether its options are listed", withValue({}, (({ optionsUnavailable: _unavailable, ...rest }) => rest)(choice))],
    ["options the server says it does not list", withValue({ optionsUnavailable: { reason: "tooMany" } }, choice)],
    ["unlisted options on a datum that is not a choice", withValue({ optionsUnavailable: { reason: "tooMany" } })],
    ["an unknown reason for unlisted options", withValue({ options: [], optionsUnavailable: { reason: "hidden" } }, choice)],
    ["a missing datum without its name", withValue({ options: [], optionsUnavailable: { reason: "missingData" } }, choice)],
    ["an unknown step of the history", { ...detail, history: [{ atUtc: "2026-10-21T21:12:00Z", kind: "printed", actor: null, detail: null }] }],
    ["four candidates", { ...detail, proposal: { ...detail.proposal, candidates: [1, 2, 3, 4].map(n => ({ ...detail.proposal!.candidates[0], definitionId: `0199b0c0-0000-7000-8000-00000000080${n}` })) } }],
    ["no forms to read it for", withoutForms],
    ["forms to read it for without «Revisar documentos»", { ...detail, canReview: false }],
    ["a form twice to read it for", { ...detail, forms: [detail.forms[0], detail.forms[0]] }],
  ])("rejects a detail with %s", (_case, body) => {
    expect(() => readReceivedDocument(body)).toThrow("Unsupported form response.");
  });
  it.each([
    ["a counter that does not add up", () => readReceivedDocumentMenuCounts({ forReview: 2, unclassified: 5, total: 8 })],
    ["a failure without its code", () => readReceivedDocumentExtraction({ requestId, state: "failed", failureCode: null })],
    ["a code of a change that did not fail", () => readReceivedDocumentExtraction({ requestId, state: "pending", failureCode: "x" })],
    // The change of form answers its state only: the document is read again.
    ["a change of form with its document", () => readReceivedDocumentExtraction({ requestId, state: "completed", failureCode: null, document: null })],
    ["a pass without its number", () => readReceivedDocumentRecord({ documentId: id, recordId: requestId, number: "", state: "Received" })],
  ])("rejects %s", (_case, read) => {
    expect(read).toThrow("Unsupported form response.");
  });
});

describe("the requests", () => {
  it("search with the private filters in a body, never in the address nor cached, and check the page asked", async () => {
    let url: URL | undefined; let cache: RequestCache | undefined; let body: unknown;
    server.use(http.post("/api/forms/documents/search", async ({ request }) => { url = new URL(request.url); cache = request.cache; body = await request.json(); return HttpResponse.json(page); }));
    await fetchReceivedDocuments({ page: 1, pageSize: 10, sort: "receivedAtUtc", search: "150000", state: "proposed", definitionId: receivedDocumentIds.other,
      senderUserId: receivedDocumentIds.pdf, receivedFromUtc: "2026-10-01T03:00:00.000Z", receivedToUtc: undefined });
    expect(url!.search).toBe("");
    expect(body).toEqual({ page: 1, pageSize: 10, sort: "receivedAtUtc", search: "150000", state: "proposed", definitionId: receivedDocumentIds.other,
      senderUserId: receivedDocumentIds.pdf, receivedFromUtc: "2026-10-01T03:00:00.000Z" });
    expect(cache).toBe("no-store");
    await expect(fetchReceivedDocuments({ page: 2, pageSize: 10 })).rejects.toThrow("Unsupported form response.");
  });

  it("read the counter, a document and its file under their routes, and compose a route only with an identity", async () => {
    server.use(
      http.get("/api/forms/documents/counts", () => HttpResponse.json({ forReview: 2, unclassified: 5, total: 7 })),
      http.get("/api/forms/documents/:id", ({ params }) => HttpResponse.json(params.id === id ? detail : receivedDocumentDetailFixture(receivedDocumentIds.pdf))),
      http.get("/api/forms/documents/:id/file", () => new HttpResponse("jpeg", { headers: { "content-type": "image/jpeg" } })));
    expect((await fetchReceivedDocumentMenuCounts()).total).toBe(7);
    expect((await fetchReceivedDocument(id)).document.id).toBe(id);
    expect((await fetchReceivedDocumentFile(id)).size).toBe(4);
    // Another document than the one asked is not this one.
    await expect(fetchReceivedDocument(receivedDocumentIds.waiting)).rejects.toThrow("Unsupported form response.");
    await expect(fetchReceivedDocument("../counts")).rejects.toThrow("Unsupported form response.");
  });

  it("search the options of a choice the server does not list, with the question and the text in a body", async () => {
    let body: unknown; let cache: RequestCache | undefined;
    const items = [{ id: requestId, text: "San Martín", group: "Buenos Aires" }, { id: receivedDocumentIds.other, text: "San Martín", group: "Mendoza" }];
    server.use(http.post("/api/forms/documents/:id/options", async ({ request, params }) => {
      body = await request.json(); cache = request.cache;
      return params.id === id ? HttpResponse.json({ items, truncated: true }) : HttpResponse.json({ items: [items[0], items[0]], truncated: false });
    }));
    expect(await searchReceivedDocumentOptions(id, { fieldId: requestId, search: "san" })).toEqual({ items, truncated: true });
    expect(body).toEqual({ fieldId: requestId, search: "san" });
    expect(cache).toBe("no-store");
    // The same option twice is not a list.
    await expect(searchReceivedDocumentOptions(receivedDocumentIds.pdf, { fieldId: requestId, search: "" })).rejects.toThrow("Unsupported form response.");
  });

  it("discard and reopen with the revision seen, and expect the next one", async () => {
    const bodies: unknown[] = [];
    const discarded = { ...detail, document: { ...detail.document, state: "discarded", forReview: false, reasonCode: "reviewer", deleteAfterUtc: "2027-02-10T12:00:00Z", revision: 2 } };
    server.use(http.post("/api/forms/documents/:id/discard", async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json(discarded); }),
      http.post("/api/forms/documents/:id/reopen", async ({ request }) => { bodies.push(await request.json()); return HttpResponse.json(discarded); }));
    expect((await discardReceivedDocument(id, 1)).document.state).toBe("discarded");
    // An answer that is not one revision after the one seen is not this change.
    await expect(reopenReceivedDocument(id, 2)).rejects.toThrow("Unsupported form response.");
    expect(bodies).toEqual([{ expectedRevision: 1 }, { expectedRevision: 2 }]);
  });

  it("change the form with its request and read it by the same request; pass it with the answers and the revision seen", async () => {
    let change: unknown; let pass: unknown; let asked: string | null = null;
    server.use(
      http.put("/api/forms/documents/:id/form", async ({ request }) => { change = await request.json(); return HttpResponse.json({ requestId, state: "pending", failureCode: null }, { status: 202 }); }),
      http.get("/api/forms/documents/:id/extraction", ({ request }) => { asked = new URL(request.url).searchParams.get("requestId"); return HttpResponse.json({ requestId, state: "completed", failureCode: null }); }),
      http.post("/api/forms/documents/:id/records", async ({ request }) => { pass = await request.json(); return HttpResponse.json({ documentId: id, recordId: requestId, number: "REC-000125", state: "Received" }); }));
    expect((await changeReceivedDocumentForm(id, { requestId, definitionId: requestId, expectedRevision: 1 })).state).toBe("pending");
    expect(change).toEqual({ requestId, definitionId: requestId, expectedRevision: 1 });
    expect((await fetchReceivedDocumentExtraction(id, requestId)).state).toBe("completed");
    expect(asked).toBe(requestId);
    await expect(fetchReceivedDocumentExtraction(id, receivedDocumentIds.pdf)).rejects.toThrow("Unsupported form response.");
    const body = { requestId, versionId: requestId, expectedRevision: 1, answers: [{ fieldId: requestId, value: "68500.00" }] };
    expect((await passReceivedDocument(id, body)).number).toBe("REC-000125");
    expect(pass).toEqual(body);
    await expect(passReceivedDocument(receivedDocumentIds.pdf, body)).rejects.toThrow("Unsupported form response.");
  });
});
