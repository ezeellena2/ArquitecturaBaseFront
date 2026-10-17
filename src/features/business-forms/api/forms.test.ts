import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { beginDraftSave, changeDraft, openDraftSession } from "../draftSession";
import { configureHttpClient, resetHttpClient } from "@/shared/api/httpClient";
import { createFormDraft, fetchFormDefinition, fetchFormDefinitions, fetchFormFacets, recoverFormDraft, updateFormDraft } from "./forms";

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
    server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition, capabilities: { canSave: false, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })));
    const detail = await fetchFormDefinition(id);
    expect(detail.audit).toEqual(audit);
    expect(detail.capabilities.canSave).toBe(false);
    expect(detail.definition.draft).toEqual({ ...definition.draft, fields: [expect.objectContaining({ label: { es: "Opinión", en: "Opinion" }, help: { es: "Detalle", en: "Details" } })] });
    expect(detail.definition.draft.fields[0]).not.toHaveProperty("options");
  });

  it("recognizes nullable .NET configuration outside its applicable type", async () => {
    server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: { ...definition, draft: { ...definition.draft,
      fields: [{ ...definition.draft.fields[0], type: "decimal", maxLength: null, options: null }] } }, capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" },
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
      http.get("/api/forms/definitions/facets", ({ request }) => { urls.push(new URL(request.url)); return HttpResponse.json({ all: 110, published: 0, drafts: 110 }); }));
    const query = { page: 3, pageSize: 50, search: "A&B", sort: "-lastChangedAtUtc" as const, publicationFilter: "Drafts" as const };
    expect(await fetchFormDefinitions(query)).toEqual(page);
    expect(await fetchFormFacets(query)).toEqual({ all: 110, published: 0, drafts: 110 });
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
  server.use(http.get(`/api/forms/definitions/${id}`, () => HttpResponse.json({ definition: changed, capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" }, audit })),
    http.get(`/api/forms/draft-changes/${requestId}`, () => HttpResponse.json({ requestId, kind: "Create", status: "Committed", committedAtUtc: "2026-10-09T12:00:00Z", currentRevision: 1, result: { ...commit, definition: changed } })));
  expect((await fetchFormDefinition(id)).definition).toHaveProperty("offerWhen", offerWhen);
  expect((await recoverFormDraft(requestId)).result.definition).toHaveProperty("offerWhen", offerWhen);
});

it.each([undefined, { es: "PRIVATE" }, "", " not normalized ", "x".repeat(1001)])("rejects a missing or noncanonical offer instruction without exposing its content: %j", async offerWhen => {
  server.use(http.post("/api/forms/definitions", () => HttpResponse.json({ ...commit, definition: { ...definition, offerWhen } }, { status: 201 })));
  await expect(createFormDraft(body)).rejects.toThrow("Unsupported form response.");
});
