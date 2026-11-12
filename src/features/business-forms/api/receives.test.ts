import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { fixtureLifecycle } from "@/test/visual/formFixtures";
import { beginDraftSave, openDraftSession } from "../draftSession";
import { acceptFormPublication, checkFormPublication, updateFormDraft } from "./forms";
import { canonicalFormFieldSchema, readFormDetail } from "./response";

// W3 (UC1-A, 2026-11-12): the text question that receives the location or the contact the person shares in the chat. The backend
// omits `receives` on a question without one, so today's forms keep their bytes. Synthetic bodies: the capture of the draft with
// `receives` arrives with the joint export (task 20).
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const id = guid(1);
const requestId = guid(2);
const question = (n: number, rest: object) => ({ fieldId: guid(n), key: "field_" + guid(n).replaceAll("-", ""), label: { es: `Pregunta ${n}` }, help: null, required: false,
  maxLength: null, options: null, ...rest });
const text = (n: number, rest: object = {}) => question(n, { type: "shortText", maxLength: 80, ...rest });
const address = text(10, { receives: "location" });
const receiver = text(11, { receives: "contactName" });
const phone = question(12, { type: "longText", maxLength: 600, receives: "contactPhone" });
const photo = question(13, { type: "photo", required: true, files: { minFiles: 1, maxFiles: 1, photoSource: "cameraOrGallery" } });
const notes = question(14, { type: "longText", maxLength: 600 });
const fields = [address, receiver, phone, photo, notes];
const definition = (draft: object = {}) => ({ offerWhen: null, id, name: { es: "Registrar entrega" }, prefix: "ENT", prefixLocked: false, revision: 1,
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields, ...draft } });
const audit = { createdAtUtc: "2026-11-12T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-11-12T12:00:00Z", lastChangedBy: null };
const detail = (draft: object = {}) => ({ definition: definition(draft), lifecycle: fixtureLifecycle(1), capabilities: { canSave: true, canPublish: true, canPreview: false }, audit,
  publication: { activeVersion: null, currentOperation: null, displayState: "Draft" } });
const received = (items: readonly { fieldId: string | null; receives?: string }[]) => items.filter(item => "receives" in item).map(item => [item.fieldId, item.receives]);
afterEach(resetHttpClient);

describe("the question that receives what is shared in the chat (W3)", () => {
  it("reads it on a short or a long text outside the block, one question per datum", () => {
    const read = readFormDetail(detail());
    expect(received(read.definition.draft.fields)).toEqual([[address.fieldId, "location"], [receiver.fieldId, "contactName"], [phone.fieldId, "contactPhone"]]);
    // Reglas and Sugerencias read the questions with the same schema.
    expect(canonicalFormFieldSchema.parse(phone)).toMatchObject({ type: "longText", receives: "contactPhone" });
  });

  it("keeps reading today's forms, which bring none, and the location of a form without a question «Ubicación»", () => {
    const today = readFormDetail(detail({ fields: [text(10), text(11), notes] }));
    expect(today.definition.draft.fields.some(field => "receives" in field)).toBe(false);
    // The contact can go to a form that asks for the location itself: only the location goes to its question «Ubicación».
    const located = question(15, { type: "location", required: true });
    expect(received(readFormDetail(detail({ fields: [located, receiver, phone] })).definition.draft.fields)).toEqual([[receiver.fieldId, "contactName"], [phone.fieldId, "contactPhone"]]);
  });

  it("sends it back as it came in the draft it saves, checks and accepts", async () => {
    const session = openDraftSession({ actorId: "actor", editorId: "editor" }, readFormDetail(detail()).definition);
    const commit = { requestId, definition: { ...definition(), revision: 2 }, identityMap: { fields: fields.map(item => ({ localId: item.fieldId, fieldId: item.fieldId, key: item.key,
      replacesFieldId: null })), choices: [] }, recovery: { path: `/api/forms/draft-changes/${requestId}`, resultExpiresAtUtc: "2026-11-13T12:00:00Z" } };
    const publication = guid(85);
    const check = { definitionId: id, draftRevision: 1, nextVersionNumber: 1, compatibility: "LocallyValidated", canAccept: true, acceptanceAvailability: "Available",
      checkToken: "private-ticket", checkExpiresAtUtc: "2026-11-12T13:00:00Z", channels: [], cultures: [], issues: [], warnings: [],
      diff: { baseVersionId: null, added: [], changed: [], removed: [], addedCultures: [], removedCultures: [] } };
    const receipt = { requestId: publication, operationId: guid(86), definitionId: id, versionId: guid(87), versionNumber: 1, draftRevision: 1, state: "Accepted",
      acceptedAtUtc: "2026-11-12T12:30:00Z", recoveryPath: `/api/forms/definitions/${id}/publications/${publication}` };
    const sent: unknown[] = [];
    server.use(
      http.put(`/api/forms/definitions/${id}/draft`, async ({ request }) => { sent.push(await request.json()); return HttpResponse.json(commit); }),
      http.post(`/api/forms/definitions/${id}/publication-checks`, async ({ request }) => { sent.push(await request.json()); return HttpResponse.json(check); }),
      http.post(`/api/forms/definitions/${id}/publications`, async ({ request }) => { sent.push(await request.json()); return HttpResponse.json(receipt, { status: 202 }); }));

    const saved = await updateFormDraft(id, { ...beginDraftSave(session, requestId).pending!.body, expectedRevision: 1 });
    await checkFormPublication(id, { ...session.value, expectedRevision: 1 });
    await acceptFormPublication(id, { ...session.value, expectedRevision: 1, requestId: publication, checkToken: "private-ticket" });

    expect(sent).toHaveLength(3);
    // Only the three questions that receive something carry the key, with the datum they came with.
    for (const body of sent as { draft: { fields: { fieldId: string | null; receives?: string }[] } }[])
      expect(received(body.draft.fields)).toEqual([[address.fieldId, "location"], [receiver.fieldId, "contactName"], [phone.fieldId, "contactPhone"]]);
    expect(received(saved.definition.draft.fields)).toHaveLength(3);
  });

  const block = question(20, { type: "group", required: true, rows: { minRows: 1, maxRows: 5 } });
  it.each([
    ["a datum it does not know", { fields: [text(10, { receives: "address" }), notes] }],
    ["null instead of omitting it", { fields: [text(10, { receives: null }), notes] }],
    ["a number", { fields: [question(16, { type: "decimal", receives: "contactPhone" }), notes] }],
    ["a catalog question", { fields: [question(17, { type: "choice", source: { catalog: guid(90) }, receives: "contactName" }), notes] }],
    ["the question «Ubicación» itself", { fields: [question(15, { type: "location", required: true, receives: "location" }), notes] }],
    ["a question of the block", { fields: [block, text(21, { repeated: true, receives: "contactName" }), notes] }],
    ["the same datum on two questions", { fields: [receiver, text(18, { receives: "contactName" }), notes] }],
    ["the location in a form with a question «Ubicación»", { fields: [address, question(15, { type: "location", required: true }), notes] }],
  ])("rejects %s", (_case, draft) => {
    expect(() => readFormDetail(detail(draft))).toThrow("Unsupported form response.");
  });
});
