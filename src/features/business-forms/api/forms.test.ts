import { fixtureLifecycle } from "@/test/visual/formFixtures";
import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { beginDraftSave, changeDraft, openDraftSession } from "../draftSession";
import { configureHttpClient, resetHttpClient } from "@/shared/api/httpClient";
import { acceptFormPublication, checkFormPublication, createFormDraft, fetchFormDefinition, fetchFormDefinitions, fetchFormFacets, recoverFormDraft, updateFormDraft } from "./forms";
import { readFormDetail } from "./response";

const id = "01990000-0000-7000-8000-000000000001";
const requestId = "01990000-0000-7000-8000-000000000002";
const fieldId = "01990000-0000-7000-8000-000000000003";
const key = `field_${fieldId.replaceAll("-", "")}`;
const definition = { offerWhen: null, id, name: { es: "Encuesta" }, prefix: "ENC", prefixLocked: false, revision: 1,
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar", en: "Submit" }, fields: [
    { fieldId, key, type: "longText", label: { es: "Opinión", en: "Opinion" }, help: { es: "Detalle", en: "Details" }, required: false, maxLength: 2000, options: null },
  ] } };
const commit = { requestId, definition, identityMap: { fields: [{ localId: "q", fieldId, key, replacesFieldId: null }], choices: [] },
  recovery: { path: `/api/forms/draft-changes/${requestId}`, resultExpiresAtUtc: "2026-11-08T12:00:00Z" } };
const body = { offerWhen: null, requestId, name: { es: "Encuesta" }, prefix: "ENC", draft: { format: 1 as const, culture: "es" as const,
  submitLabel: { es: "Enviar", en: "Submit" }, fields: [{ localId: "q", fieldId: null, replacesFieldId: null, type: "longText" as const,
    label: { es: "Opinión", en: "Opinion" }, help: { es: "Detalle", en: "Details" }, required: false, maxLength: 2000 }] } };
afterEach(resetHttpClient);

describe("form draft HTTP contract", () => {
  it("preserves pending secondary names and labels without filling them from the original", async () => {
    const pending = { ...definition, name: { es: "Encuesta", en: "" }, draft: { ...definition.draft,
      submitLabel: { es: "Enviar" }, fields: [{ ...definition.draft.fields[0]!, label: { es: "Opinión", en: "" }, help: { en: "Details" } }] } };
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ ...commit, definition: pending }, { status: 201 })));
    const saved = await createFormDraft({ ...body, name: { es: "Encuesta", en: "" } });
    expect(saved.definition.name).toEqual({ es: "Encuesta", en: "" });
    expect(saved.definition.draft.submitLabel).toEqual({ es: "Enviar" });
    expect(saved.definition.draft.fields[0]!.label).toEqual({ es: "Opinión", en: "" });
  });
  it.each([{ name: "legacy" }, { name: { es: "Original", fr: "unknown" } }, { name: { en: "Missing original" } }])("rejects noncanonical names without disclosing the content: %j", async change => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ ...commit, definition: { ...definition, ...change } })));
    await expect(createFormDraft(body)).rejects.toThrow("Unsupported form response.");
  });

  it("sends the exact create and update bodies, accepting a direct commit", async () => {
    const received: unknown[] = [];
    server.use(http.post("/api/forms/definitions", async ({ request }) => { received.push(await request.json()); return HttpResponse.json(commit, { status: 201 }); }),
      http.put(`/api/forms/definitions/${id}/draft`, async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ ...commit, definition: { ...definition, revision: 2 } }); }));
    expect((await createFormDraft(body)).definition.draft.fields[0]).toMatchObject({ maxLength: 2000 });
    await updateFormDraft(id, { ...body, expectedRevision: 1 });
    expect(received).toEqual([body, { ...body, expectedRevision: 1 }]);
    expect(received[0]).not.toHaveProperty("expectedRevision");
  });

  it.each([{ es: null, en: "Details" }, { es: null, en: null }])("sends explicit help erasure and the saved submit label in a frozen update: %j", async help => {
    const saved = { ...definition, draft: { ...definition.draft, format: 1 as const, culture: "es" as const,
      submitLabel: { es: "Confirmar", en: "Confirm" },
      fields: [{ ...definition.draft.fields[0]!, type: "longText" as const }] } };
    let session = openDraftSession({ actorId: "actor", editorId: "editor" }, saved);
    session = changeDraft(session, { ...session.value, draft: { ...session.value.draft,
      fields: session.value.draft.fields.map(field => ({ ...field, help })) } });
    const pending = beginDraftSave(session, requestId).pending!;
    server.use(http.put(`/api/forms/definitions/${id}/draft`, async ({ request }) => {
      expect(await request.json()).toEqual(pending.body);
      expect(pending.body.draft.submitLabel).toEqual({ es: "Confirmar", en: "Confirm" });
      expect(pending.body.draft.fields[0]!.help).toEqual(help);
      expect(Object.isFrozen(pending.body.draft.fields[0]!.help)).toBe(true);
      return HttpResponse.json({ ...commit, definition: { ...saved, revision: 2, draft: { ...saved.draft,
        fields: [{ ...saved.draft.fields[0]!, help: help.en ? { en: help.en } : null }] } } });
    }));
    expect(pending.body.expectedRevision).toBe(1);
    const updated = await updateFormDraft(id, { ...pending.body, expectedRevision: pending.body.expectedRevision! });
    expect(updated.definition.draft.fields[0]!.help).toEqual(help.en ? { en: help.en } : null);
  });

  it("consumes the detail wrapper and preserves every translation and audit value", async () => {
    const audit = { createdAtUtc: "2026-10-09T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-09T12:00:00Z", lastChangedBy: null };
    server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition, lifecycle: fixtureLifecycle(definition.revision), capabilities: { canSave: false, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })));
    const detail = await fetchFormDefinition(id);
    expect(detail.audit).toEqual(audit);
    expect(detail.capabilities.canSave).toBe(false);
    expect(detail.definition.draft).toEqual({ ...definition.draft, fields: [expect.objectContaining({ label: { es: "Opinión", en: "Opinion" }, help: { es: "Detalle", en: "Details" } })] });
    expect(detail.definition.draft.fields[0]).not.toHaveProperty("options");
  });

  it("recognizes nullable .NET configuration outside its applicable type", async () => {
    server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: { ...definition, draft: { ...definition.draft,
      fields: [{ ...definition.draft.fields[0], type: "decimal", maxLength: null, options: null }] } }, lifecycle: fixtureLifecycle(definition.revision), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" },
      audit: { createdAtUtc: "2026-10-09T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-09T12:00:00Z", lastChangedBy: null } })));
    const field = (await fetchFormDefinition(id)).definition.draft.fields[0];
    expect(field.type).toBe("decimal");
    expect(field).not.toHaveProperty("maxLength");
    expect(field).not.toHaveProperty("options");
  });

  it.each([
    { type: "multipleChoice" }, { maxLength: null }, { options: [] }, { precision: 2 }, { label: { es: "ok", fr: "inconnu" } },
  ])("rejects unsupported canonical content without disclosing its body: %j", async change => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ ...commit, definition: { ...definition, draft: { ...definition.draft,
      fields: [{ ...definition.draft.fields[0], ...change, help: { es: "PRIVATE CONTENT" } }] } } })));
    await expect(createFormDraft(body)).rejects.toThrow("Unsupported form response.");
  });

  it("encodes list filters/sort/paging and consumes the direct page and facets", async () => {
    const urls: URL[] = [];
    const page = { items: [], page: 3, pageSize: 50, totalCount: 110, totalPages: 3, hasPrevious: true, hasNext: false };
    server.use(http.get("/api/forms/definitions", ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json(page); }),
      http.get("/api/forms/definitions/facets", ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json({ active: 110, published: 0, drafts: 110, deactivated: 0 }); }));
    const query = { page: 3, pageSize: 50, search: "A&B", sort: "-lastChangedAtUtc" as const, publicationFilter: "Drafts" as const };
    expect(await fetchFormDefinitions(query)).toEqual(page);
    expect(await fetchFormFacets(query)).toEqual({ active: 110, published: 0, drafts: 110, deactivated: 0 });
    expect(urls.map(url => Object.fromEntries(url.searchParams))).toEqual([{ ...query, page: "3", pageSize: "50" }, { search: query.search }]);
  });

  it("recovers using the owned constructed path and keeps the original result revision", async () => {
    configureHttpClient({ getAccessToken: () => "owned-token" });
    server.use(http.get(`/api/forms/draft-changes/${requestId}`, ({ request }) => {
      expect(request.headers.get("authorization")).toBe("Bearer owned-token");
      return HttpResponse.json({ requestId, kind: "Create", status: "Committed", committedAtUtc: "2026-10-09T12:00:00Z", currentRevision: 4, result: commit });
    }));
    expect(await recoverFormDraft(requestId)).toMatchObject({ currentRevision: 4, result: { definition: { revision: 1 } } });
    await expect(recoverFormDraft("https://foreign.example/private")).rejects.toThrow();
  });

  it("rejects a recovery URL supplied by the payload instead of following it", async () => {
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ ...commit, recovery: { ...commit.recovery, path: "https://foreign.example/private" } })));
    await expect(createFormDraft(body)).rejects.toThrow("Unsupported form response.");
  });

  it.each(["format", "revision", "translation", "duplicate"])("rejects a canonical draft with invalid %s", async invalid => {
    const broken = structuredClone(definition);
    if (invalid === "format") broken.draft.format = 2;
    if (invalid === "revision") broken.revision = Number.MAX_SAFE_INTEGER + 1;
    if (invalid === "translation") broken.draft.submitLabel = { en: "Submit" } as typeof definition.draft.submitLabel;
    if (invalid === "duplicate") broken.draft.fields.push({ ...broken.draft.fields[0]! });
    server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ ...commit, definition: broken })));
    await expect(createFormDraft(body)).rejects.toThrow("Unsupported form response.");
  });
});

it.each([null, "Cuando visita a un cliente"])("preserves the canonical monolingual offer instruction in detail and recovery: %j", async offerWhen => {
  const changed = { ...definition, offerWhen };
  const audit = { createdAtUtc: "2026-10-09T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-09T12:00:00Z", lastChangedBy: null };
  server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: changed, lifecycle: fixtureLifecycle(changed.revision), capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })),
    http.get(`/api/forms/draft-changes/${requestId}`, () => HttpResponse.json({ requestId, kind: "Create", status: "Committed", committedAtUtc: "2026-10-09T12:00:00Z", currentRevision: 1, result: { ...commit, definition: changed } })));
  expect((await fetchFormDefinition(id)).definition).toHaveProperty("offerWhen", offerWhen);
  expect((await recoverFormDraft(requestId)).result.definition).toHaveProperty("offerWhen", offerWhen);
});

it.each([undefined, { es: "PRIVATE" }, "", " not normalized ", "x".repeat(1001)])("rejects a missing or noncanonical offer instruction without exposing its content: %j", async offerWhen => {
  server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ ...commit, definition: { ...definition, offerWhen } }, { status: 201 })));
  await expect(createFormDraft(body)).rejects.toThrow("Unsupported form response.");
});

// DOC1 (2026-11-11): the reading of documents in the draft and in the published version, and the fixed validation of a short text
// bound by a library standard. Synthetic bodies: the backend omits all three when there is nothing, so today's forms keep their bytes.
describe("document reading and fixed validations (DOC1)", () => {
  const question = (n: number) => { const fieldId = "01990000-0000-7000-8000-" + String(500 + n).padStart(12, "0"); return { fieldId, key: `field_${fieldId.replaceAll("-", "")}` }; };
  const catalog = (n: number) => ({ ...question(n), type: "choice", label: { es: `Catálogo ${n}` }, help: null, required: false, maxLength: null, options: null, source: { catalog: question(90).fieldId } });
  const account = { ...question(20), type: "shortText", label: { es: "Cuenta de origen" }, help: null, required: true, maxLength: 80, options: null, validation: "bankAccount" };
  const taxId = { ...question(21), type: "shortText", label: { es: "CUIT o CUIL de origen" }, help: null, required: false, maxLength: 13, options: null, validation: "taxId" };
  const notes = definition.draft.fields[0]!;
  const fields = [catalog(0), catalog(1), catalog(2), catalog(3), catalog(4), account, taxId, notes];
  // The five lookups the reading admits: by the option's code, by its text or by a catalog field.
  const lookups = [
    { questionId: catalog(0).fieldId, sourceQuestionId: account.fieldId, field: "code" }, { questionId: catalog(1).fieldId, sourceQuestionId: taxId.fieldId, field: "text" },
    { questionId: catalog(2).fieldId, sourceQuestionId: notes.fieldId, field: question(91).fieldId }, { questionId: catalog(3).fieldId, sourceQuestionId: account.fieldId, field: "text" },
    { questionId: catalog(4).fieldId, sourceQuestionId: taxId.fieldId, field: "code" }];
  const reading = { enabled: true, recognition: "Comprobante de una transferencia: cuenta, titular, monto y fecha.", lookups };
  const audit = { createdAtUtc: "2026-11-11T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-11-11T12:00:00Z", lastChangedBy: null };
  const activeVersion = { versionId: question(80).fieldId, versionNumber: 1, draftRevision: 1, cultures: ["es"] };
  const detail = (draft: object = {}, version: object | null = null, extra: object = {}) => ({ definition: { ...definition, ...extra, draft: { ...definition.draft, fields, ...draft } },
    lifecycle: fixtureLifecycle(1), capabilities: { canSave: true, canPublish: true, canPreview: false }, audit,
    publication: { activeVersion: version, currentOperation: null, displayState: version ? "Published" : "Draft" } });

  it("reads the reading with its lookups, the version published with it and the fixed validations", () => {
    const read = readFormDetail(detail({ documentReading: reading }, { ...activeVersion, documentReading: true }));
    expect(read.definition.draft.documentReading).toEqual(reading);
    expect(read.publication.activeVersion?.documentReading).toBe(true);
    expect(read.definition.draft.fields[5]).toMatchObject({ type: "shortText", validation: "bankAccount" });
    expect(read.definition.draft.fields[6]).toMatchObject({ type: "shortText", validation: "taxId" });
    // Turned off, it keeps what was written; «Cómo reconocerlo» takes up to 1000 characters.
    const off = { enabled: false, recognition: "", lookups: [] };
    expect(readFormDetail(detail({ documentReading: off })).definition.draft.documentReading).toEqual(off);
    expect(readFormDetail(detail({ documentReading: { ...reading, recognition: "x".repeat(1000) } })).definition.draft.documentReading?.recognition).toHaveLength(1000);
  });

  it("keeps reading today's forms, which bring none of them", () => {
    const today = readFormDetail(detail({ fields: definition.draft.fields }, activeVersion));
    expect(today.definition.draft).not.toHaveProperty("documentReading");
    expect(today.publication.activeVersion).not.toHaveProperty("documentReading");
    expect(today.definition.draft.fields[0]).not.toHaveProperty("validation");
  });

  it("sends the reading and the fixed validations back as they came in the draft it saves, checks and accepts", async () => {
    const standard = { key: "forms.transfer-receipt", version: 1, bound: { sourceAccount: account.fieldId, sourceTaxId: taxId.fieldId } };
    const session = openDraftSession({ actorId: "actor", editorId: "editor" }, readFormDetail(detail({ documentReading: reading }, null, { standard })).definition);
    const publication = question(85).fieldId;
    const check = { definitionId: id, draftRevision: 1, nextVersionNumber: 1, compatibility: "LocallyValidated", canAccept: true, acceptanceAvailability: "Available",
      checkToken: "private-ticket", checkExpiresAtUtc: "2026-11-11T13:00:00Z", channels: [], cultures: [], issues: [], warnings: [],
      diff: { baseVersionId: null, added: [], changed: [], removed: [], addedCultures: [], removedCultures: [] } };
    const receipt = { requestId: publication, operationId: question(86).fieldId, definitionId: id, versionId: question(87).fieldId, versionNumber: 1, draftRevision: 1,
      state: "Accepted", acceptedAtUtc: "2026-11-11T12:30:00Z", recoveryPath: `/api/forms/definitions/${id}/publications/${publication}` };
    const sent: unknown[] = [];
    server.use(
      http.put(`/api/forms/definitions/${id}/draft`, async ({ request }) => { sent.push(await request.json()); return HttpResponse.json({ ...commit, definition: { ...definition, revision: 2 } }); }),
      http.post(`/api/forms/definitions/${id}/publication-checks`, async ({ request }) => { sent.push(await request.json()); return HttpResponse.json(check); }),
      http.post(`/api/forms/definitions/${id}/publications`, async ({ request }) => { sent.push(await request.json()); return HttpResponse.json(receipt, { status: 202 }); }));

    await updateFormDraft(id, { ...beginDraftSave(session, requestId).pending!.body, expectedRevision: 1 });
    await checkFormPublication(id, { ...session.value, expectedRevision: 1 });
    await acceptFormPublication(id, { ...session.value, expectedRevision: 1, requestId: publication, checkToken: "private-ticket" });

    expect(sent).toHaveLength(3);
    for (const body of sent as { draft: { documentReading?: unknown; fields: { fieldId: string | null; validation?: string }[] } }[]) {
      expect(body.draft.documentReading).toEqual(reading);
      // Only the two bound short texts carry the key, with the kind they came with; every other question goes without it.
      expect(body.draft.fields.filter(field => "validation" in field).map(field => [field.fieldId, field.validation])).toEqual([[account.fieldId, "bankAccount"], [taxId.fieldId, "taxId"]]);
    }
  });

  it.each([
    ["«Cómo reconocerlo» over 1000 characters", { documentReading: { ...reading, recognition: "x".repeat(1001) } }],
    ["«Cómo reconocerlo» with spaces around it", { documentReading: { ...reading, recognition: ` ${reading.recognition}` } }],
    ["the reading on without «Cómo reconocerlo»", { documentReading: { ...reading, recognition: "" } }],
    ["six lookups", { fields: [...fields, catalog(5)], documentReading: { ...reading, lookups: [...lookups, { questionId: catalog(5).fieldId, sourceQuestionId: account.fieldId, field: "code" }] } }],
    ["a lookup that fills a question without catalog", { documentReading: { ...reading, lookups: [{ ...lookups[0], questionId: taxId.fieldId }] } }],
    ["a lookup that reads a question outside the draft", { documentReading: { ...reading, lookups: [{ ...lookups[0], sourceQuestionId: question(99).fieldId }] } }],
    ["a lookup that reads the question it fills", { documentReading: { ...reading, lookups: [{ ...lookups[0], sourceQuestionId: catalog(0).fieldId }] } }],
    ["two lookups that fill the same question", { documentReading: { ...reading, lookups: [lookups[0], { ...lookups[1], questionId: catalog(0).fieldId }] } }],
    ["a lookup that compares something other than the code, the text or a field", { documentReading: { ...reading, lookups: [{ ...lookups[0], field: "detail" }] } }],
    ["an unknown member in the reading", { documentReading: { ...reading, private: true } }],
    ["an unknown validation kind", { fields: [{ ...account, validation: "cbu" }] }],
    ["a validation on a long text", { fields: [{ ...account, type: "longText", maxLength: 2000 }] }],
    ["a validation on a decimal", { fields: [{ ...account, type: "decimal", maxLength: null }] }],
    ["a validation on a catalog question", { fields: [{ ...catalog(0), validation: "taxId" }] }],
  ])("rejects %s", (_case, draft) => {
    expect(() => readFormDetail(detail(draft))).toThrow("Unsupported form response.");
  });

  it("rejects a published version that says false instead of omitting the reading", () => {
    expect(() => readFormDetail(detail({}, { ...activeVersion, documentReading: false }))).toThrow("Unsupported form response.");
  });
});
